var createConnection = require("net").createConnection,
	inherits = require("util").inherits,
	EventEmitter = require("events").EventEmitter,
	createHash = require("crypto").createHash,
	Server = require("./Server").Server,
	MySqlError = require("./MySqlError").MySqlError,
	Packet = require("./Packet").Packet,
	OutgoingPacket = require("./OutgoingPacket").OutgoingPacket,
	HandshakePacket = require("./packets/HandshakePacket").HandshakePacket,
	ParseablePacket = require("./packets/ParseablePacket").ParseablePacket,
	HeaderPacket = require("./packets/HeaderPacket").HeaderPacket,
	ColumnPacket = require("./packets/ColumnPacket").ColumnPacket,
	RowPacket = require("./packets/RowPacket").RowPacket;

/**
 * A connection to a MySQL server
 * 
 * @constructor
 * @extends EventEmitter
 * @param {string} user the user
 * @param {?string=} password the password
 * @param {string=} host the host to connect to
 * @param {number=} port the port to use
 */
function Connection(user, password, host, port) {
	EventEmitter.call(this);
	
	this.host = host;
	this.user = user;
	this.password = password ? createHash("sha1").update(password).digest("binary") : null;
	this.port = port ? port : 3306;
	this.listeners = [];
	this.queue = [];
	this.options = {
		bufferRows: false,
		fetchMode: 0, // 0 = num, 1 = assoc, 2 = array
		autoBox: false
	};
	
	this.conn = createConnection(this.port, this.host);
	this.conn.on("data", this.data.bind(this));
}

inherits(Connection, EventEmitter);

/**
 * An enum for the connection states.
 * 
 * @enum {number}
 */
Connection.States = {
	HANDSHAKE: 0,
	AUTHENTICATE: 1,
	CONNECTED: 2,
	QUERYING: 3
};

/**
 * Fetchstates of a query
 * 
 * @enum {number}
 */
Connection.Fetchstate = {
	HEADER: 1,
	FIELD: 2,
	ROW: 3,
	END: 4
};

/**
 * A tcp connection
 * 
 * @type {net.Stream}
 */
Connection.prototype.conn = null;

/**
 * The host to connect to
 * 
 * @type {string}
 */
Connection.prototype.host = null;

/**
 * The port to use
 * 
 * @type {number}
 */
Connection.prototype.port = null;

/**
 * A user
 * 
 * @type {string}
 */
Connection.prototype.user = process.env["USER"];

/**
 * A hashed password
 * 
 * @type {?string}
 */
Connection.prototype.password = null;

/**
 * The connection state
 * 
 * @type {Connection.States}
 */
Connection.prototype.state = Connection.States.HANDSHAKE;

/**
 * A server information object
 * 
 * @type {Server}
 */
Connection.prototype.server = null;

/**
 * The current packet number
 * 
 * @type {number}
 */
Connection.prototype.packetNo = 0;

/**
 * The current query-queue
 * 
 * @type {Array.<{opcode: number, cmd: string, listener: function(ParseablePacket), state: Connection.Fetchstate, fields: Array.<ColumnPacket>, rows: Array.<Object.<*>>}>}
 */
Connection.prototype.queue = null;

/**
 * Options for the connection
 * 
 * @type {Object.<*, *>}
 */
Connection.prototype.options = null;

/**
 * A partial buffer of a packet
 * 
 * @type {Buffer}
 */
Connection.prototype.partial = null;

/**
 * Connects to a server after the connection was destroyed
 */
Connection.prototype.connect = function() {
	this.conn.connect(this.port, this.host);
};

/**
 * Function for handling all incoming data packets.
 * 
 * @param {Buffer} data the incoming data
 */
Connection.prototype.data = function(data) {
	if (this.partial) {
		var temp = new Buffer(this.partial.length+data.length);
		this.partial.copy(temp);
		data.copy(temp, this.partial.length);
		data = temp;
		this.partial = null;
	}
	for (var i=0; i < data.length;) {
		try {
			var packet = new Packet(data.slice(i, data.length));
		} catch (e) {
			this.partial = data.slice(i, data.length);
			break;
		}
		switch (this.state) {
			case Connection.States.HANDSHAKE:
				var processedPacket = new HandshakePacket(packet);
				this.server = processedPacket.server;
				this.authorize(processedPacket.scramble);
				this.state = Connection.States.AUTHENTICATE;
				break;
			case Connection.States.AUTHENTICATE:
				if (packet.data[0] === 0x00) {
					this.state = Connection.States.CONNECTED;
					this.emit("authenticated", new ParseablePacket(packet));
				} else if (packet.data[0] === 0xFF) {
					var processedPacket = new ParseablePacket(packet);
					this.emit("error", new MySqlError(processedPacket.errNo, processedPacket.sqlState, processedPacket.message), processedPacket);
				} else {
					this.emit("error", new Error("Got an unknown packet during authentication."), packet);
				}
				break;
			case Connection.States.QUERYING:
				switch (packet.data[0]) {
					case 0x00:
					case 0xFF:
						this.state = Connection.States.CONNECTED;
						var processedPacket = new ParseablePacket(packet);
						var q = this.queue.shift();
						if (q.listener) {
							q.listener(processedPacket.errNo ? processedPacket.message : null, processedPacket);
						}
						this.request();
						break;
					default:
						var q = this.queue[0];
						switch (q.state) {
							case undefined:
								if (q.opcode === 0x09) {
									this.queue.shift();
									if (q.listener)
										q.listener(null, packet.data.toString("ascii"));
									this.request();
									continue;
								}
								q.state = Connection.Fetchstate.FIELD;
								break;
							case Connection.Fetchstate.FIELD:
								if (packet.data[0] == 0xFE) {
									q.state = Connection.Fetchstate.ROW;
									i += packet.length+4;
									if (q.opcode === 0x04) {
										this.queue.shift();
										if (q.listener)
											q.listener(null, q.fields);
										this.request();
									}
									continue;
								}
								var processedPacket = new ColumnPacket(packet);
								q.fields[q.fields.length] = processedPacket;
								if (q.columnCb) {
									q.columnCb(processedPacket);
								}
								break;
							case Connection.Fetchstate.ROW:
								if (packet.data[0] == 0xFE) {
									i += packet.length+4;
									var q = this.queue.shift();
									if (q.listener)
										q.listener(null, this.options.bufferRows ? q.rows : null);
									this.request();
									continue;
								}
								var processedPacket = new RowPacket(packet),
									dict = processedPacket.data;
								switch (this.options.fetchMode) {
									case 0:
										if (this.options.autoBox) {
											for (var j=0; j < q.fields.length; ++j) {
												dict[q.fields[j].name] = this.autoBox(processedPacket.data[j], q.fields[j].type);
											}
										}
										break;
									case 1:
										dict = {};
										if (this.options.autoBox) {
											for (var j=0; j < q.fields.length; ++j) {
												dict[q.fields[j].name] = this.autoBox(processedPacket.data[j], q.fields[j].type);
											}
										} else {
											for (var j=0; j < q.fields.length; ++j) {
												dict[q.fields[j].name] = processedPacket.data[j];
											}
										}
										break;
									case 2:
										if (this.options.autoBox) {
											for (var j=0; j < q.fields.length; ++j) {
												dict[j] = dict[q.fields[j].name] = this.autoBox(dict[j], q.fields[j].type);
											}
										} else {
											for (var j=0; j < q.fields.length; ++j) {
												dict[j] = dict[q.fields[j].name] = dict[j];
											}
										}
										break;
								}
								if (this.options.bufferRows) {
									q.rows[q.rows.length] = dict;
								}
								if (q.rowCb) {
									q.rowCb(dict);
								}
								break;
						}
						break;
				}
				break;
		}
		i += packet.length+4;
	}
};

/**
 * Authorizes the client with the password.
 * 
 * @param {Buffer} scramble the scramble given by the server.
 */
Connection.prototype.authorize = function(scramble) {
	var out = new OutgoingPacket();
	out.writeFixedNumber(Server.defaultCapabilities, 4);
	out.writeFixedNumber(4294967295, 4);
	out.writeFixedNumber(8, 1);
	out.writeFiller(23);
	out.writeString(this.user);
	out.writeLengthString(Connection.createScramble(scramble, this.password));
	this.conn.write(out.getBuffer(1), "ascii");
};

/**
 * Creates a full authentication scramble out of the server sent scramble and the users password.
 * 
 * @param {Buffer} scramble the server sent scramble
 * @param {?string} password the password of the user
 */
Connection.createScramble = function(scramble, password) {
	if (password === null) return '';
	var hashed = createHash("sha1").update(scramble.toString("binary") + createHash("sha1").update(password).digest("binary")).digest("binary");
	hashed = new Buffer(hashed, "binary");
	var b = new Buffer(password, "binary");
	var i = hashed.length;
	while (i--) {
		hashed[i] = hashed[i] ^ b[i];
	}
	return hashed.toString("binary");
};

/**
 * Converts the mysql datatype to a javascript one.
 * 
 * @param {string} value the value to convert
 * @param {number} type the type to convert to
 */
Connection.prototype.autoBox = function(value, type) {
	switch (type) {
		case 0x00:
		case 0x04:
		case 0x05:
		case 0xF6:
			return parseFloat(value);
			break;
		case 0x01:
		case 0x02:
		case 0x03:
		case 0x07:
		case 0x08:
		case 0x09:
		case 0x0D:
			return parseInt(value);
			break;
		case 0x06:
			return null;
			break;
		case 0x0A:
		case 0x0C:
		case 0x0E:
			return new Date(value);
			break;
		case 0x10:
			return value === '\u0000' ? false : true;
			break;
		default:
			return value;
			break;
	}
};

/**
 * Selects a database.
 * 
 * @param {string} db the database to select
 * @param {function(?string, ParseablePacket)} cb a callback to call after the query execution
 */
Connection.prototype.close = function(cb) {
	this.queue.push({opcode: 0x01, listener: cb});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * Immediately destroys the connection.
 */
Connection.prototype.destroy = function() {
	this.conn.destroy();
	this.state = Connection.States.HANDSHAKE;
};

/**
 * Selects a database.
 * 
 * @param {string} db the database to select
 * @param {function(ParseablePacket)} cb a callback to call after the query execution
 */
Connection.prototype.selectDb = function(db, cb) {
	this.queue.push({opcode: 0x02, cmd: db, listener: cb});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * Sends a query to the database
 * 
 * @param {string} cmd the command to send
 * @param {function(string, Object.<*, *>)} cb a callback to call after query execution
 * @param {function(string, ColumnPacket)} columnCb a callback to call for each column
 * @param {function(string, RowPacket)} rowCb a callback to call for each row/buffered
 */
Connection.prototype.query = function(cmd, cb, columnCb, rowCb) {
	this.queue.push({opcode: 0x03, cmd: cmd, listener: cb, columnCb: columnCb, rowCb: rowCb, fields: [], rows: []});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * List the fields of a table
 * 
 * @param {string} table the table to select the fields from
 * @param {?string} column a selector for the column
 * @param {function(string, Object.<*, *>)} cb a callback to call after query execution
 * @param {function(string, ColumnPacket)} columnCb a callback to call for each column
 * @param {function(string, RowPacket)} rowCb a callback to call for each row/buffered
 */
Connection.prototype.listFields = function(table, column, cb, columnCb) {
	if (typeof column === "function") {
		rowCb = columnCb;
		columnCb = cb;
		cb = column;
		column = '';
	}
	this.queue.push({opcode: 0x04, cmd: [table, column], state: Connection.Fetchstate.FIELD, listener: cb, columnCb: columnCb, fields: [], rows: []});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * Refresh data of the server
 * 
 * @param {number} type the type of the refresh (0x01...REFRESH_GRANT, 0x02...REFRESH_LOG, 0x04...REFRESH_TABLES, 0x08...REFRESH_HOSTS, 0x10...REFRESH_STATUS, 0x20...REFRESH_THREADS, 0x40...REFRESH_SLAVE, 0x80...REFRESH_MASTER)
 * @param {function(string, ParseablePacket)} cb a callback to call after query execution
 */
Connection.prototype.refresh = function(type, cb) {
	this.queue.push({opcode: 0x07, cmd: type, listener: cb});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * Shuts down the server.
 * 
 * @param {number} type the type of the refresh (0x00...SHUTDOWN_DEFAULT, 0x01...SHUTDOWN_WAIT_CONNECTIONS, 0x02...SHUTDOWN_WAIT_TRANSACTIONS, 0x08...SHUTDOWN_WAIT_UPDATES, 0x10...SHUTDOWN_WAIT_ALL_BUFFERS, 0x11...SHUTDOWN_WAIT_CRITICAL_BUFFERS, 0xFE...KILL_QUERY, 0xFF... KILL_CONNECTION)
 * @param {function(string, ParseablePacket)} cb a callback to call after query execution
 */
Connection.prototype.shutdown = function(type, cb) {
	this.queue.push({opcode: 0x08, cmd: type, listener: cb});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * Gets some statistics from the server
 * 
 * @param {function(string, ParseablePacket)} cb a callback to call after query execution
 */
Connection.prototype.stats = function(cb) {
	this.queue.push({opcode: 0x09, listener: cb});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * Equals to the command SHOW PROCESSLIST
 * 
 * @param {function(string, Object.<*, *>)} cb a callback to call after query execution
 * @param {function(string, ColumnPacket)} columnCb a callback to call for each column
 * @param {function(string, RowPacket)} rowCb a callback to call for each row/buffered
 */
Connection.prototype.processList = function(cb, columnCb, rowCb) {
	this.queue.push({opcode: 0x0A, listener: cb, columnCb: columnCb, rowCb: rowCb, fields: [], rows: []});
	if (this.queue.length === 1) {
		this.request();
	}
};

/**
 * Fires off the next query, or a drain event, if no more querys in the queue.
 */
Connection.prototype.request = function() {
	if (this.queue.length === 0) {
		this.emit('drain');
	} else {
		var out = new OutgoingPacket();
		out.writeFixedNumber(this.queue[0].opcode, 1);
		switch (this.queue[0].opcode) {
			case 0x02:
			case 0x03:
				out.writeString(this.queue[0].cmd, true);
				break;
			case 0x04:
				out.writeString(this.queue[0].cmd[0]);
				out.writeString(this.queue[0].cmd[1], true);
				break;
			case 0x07:
			case 0x08:
				out.writeFixedNumber(this.queue[0].cmd);
				break;
		}
		this.state = Connection.States.QUERYING;
		this.conn.write(out.getBuffer(0), "ascii");
	}
};

exports.Connection = Connection;
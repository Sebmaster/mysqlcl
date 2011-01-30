var createConnection = require("net").createConnection,
	inherits = require("util").inherits,
	EventEmitter = require("events").EventEmitter,
	createHash = require("crypto").createHash,
	Server = require("./Server").Server,
	MySqlError = require("./MySqlError").MySqlError,
	Packet = require("./Packet").Packet,
	OutgoingPacket = require("./OutgoingPacket").OutgoingPacket,
	HandshakePacket = require("./HandshakePacket").HandshakePacket,
	ParseablePacket = require("./ParseablePacket").ParseablePacket;

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
	STANDARD: 0,
	RESULTSET: 1
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
Connection.prototype.user = process.env['USER'];

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
 * @type {Array.<{opcode: number, cmd: string, listener: function(ParseablePacket), state: Connection.Fetchstate, packets: Array.<Packet>}>}
 */
Connection.prototype.queue = null;

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
	var packet = new Packet(data);
	switch (this.state) {
		case Connection.States.HANDSHAKE:
			packet = new HandshakePacket(packet);
			this.server = packet.server;
			this.authorize(packet.scramble);
			this.state = Connection.States.AUTHENTICATE;
			break;
		case Connection.States.AUTHENTICATE:
			if (packet.data[0] === 0x00) {
				this.state = Connection.States.CONNECTED;
				this.emit('authenticated', new ParseablePacket(packet));
			} else if (packet.data[0] === 0xFF) {
				packet = new ParseablePacket(packet);
				this.emit('error', new MySqlError(packet.errNo, packet.sqlState, packet.message), packet);
			} else {
				this.emit('error', new Error('Got an unknown packet during authentication.'), packet);
			}
			break;
		case Connection.States.QUERYING:
			switch (packet.getFixedNumber({index: 0}, 1)) {
				case 0x00:
				case 0xFF:
					this.state = Connection.States.CONNECTED;
					packet = new ParseablePacket(packet);
					var q = this.queue.shift();
					if (q.listener)
						q.listener(packet.errNo ? packet.message : null, packet);
					this.request();
					break;
				default:
					this.emit('error', new Error('This library does currently NOT support result packets!'), packet);
					break;
			}
			break;
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
	this.conn.write(out.getBuffer(1), 'ascii');
};

/**
 * Creates a full authentication scramble out of the server sent scramble and the users password.
 * 
 * @param {Buffer} scramble the server sent scramble
 * @param {?string} password the password of the user
 */
Connection.createScramble = function(scramble, password) {
	if (password === null) return '';
	var hashed = createHash('sha1').update(scramble.toString('binary') + createHash('sha1').update(password).digest('binary')).digest('binary');
	hashed = new Buffer(hashed, 'binary');
	var b = new Buffer(password, 'binary');
	var i = hashed.length;
	while (i--) {
		hashed[i] = hashed[i] ^ b[i];
	}
	return hashed.toString('binary');
};

/**
 * Selects a database.
 * 
 * @param {string} db the database to select
 * @param {function(ParseablePacket)} cb a callback to call after the query execution
 */
Connection.prototype.close = function(cb) {
	this.queue.push({opcode: 0x01, cmd: null, listener: cb});
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
 * @param {function(ParseablePacket)} cb a callback to call after the query execution
 */
Connection.prototype.query = function(cmd, cb) {
	this.queue.push({opcode: 0x03, cmd: cmd, listener: cb});
	if (this.queue.length === 1) {
		this.request();
	}
};

Connection.prototype.request = function() {
	if (this.queue.length === 0) {
		this.emit('drain');
	} else {
		var out = new OutgoingPacket();
		out.writeFixedNumber(this.queue[0].opcode, 1);
		if (this.queue[0].cmd) {
			out.writeString(this.queue[0].cmd, true);
		}
		this.state = Connection.States.QUERYING;
		this.conn.write(out.getBuffer(0), 'ascii');
	}
};

exports.Connection = Connection;
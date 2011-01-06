var net = require("net"),
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
	
	if (!port) {
		port = 3306;
	}
	
	this.user = user;
	this.password = password ? createHash("sha1").update(password).digest("binary") : null;
	this.listeners = [];
	
	this.conn = net.createConnection(port, host);
	//this.conn.setNoDelay(true); //TODO: Change this to true if possible
	this.conn.on("data", this.data.bind(this));
}

inherits(Connection, EventEmitter);

/**
 * A tcp connection
 * 
 * @type {net.Stream}
 */
Connection.prototype.conn = null;

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
 * Querylisteners
 * 
 * @type {Array.<{listener: function(ParseablePacket), state: Connection.Fetchstate, packets: Array.<Packet>}>}
 */
Connection.prototype.listeners = null;

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
			packet = new ParseablePacket(packet);
			if (packet.fieldCount === 0x00) {
				this.state = Connection.States.CONNECTED;
				this.emit('authenticated', packet);
			} else if (packet.fieldCount === 0xFF) {
				this.emit('error', new MySqlError(packet.errNo, packet.sqlState, packet.message), packet);
			} else {
				this.emit('error', new Error('Got an unknown packet during authentication.'), packet);
			}
			break;
		case Connection.States.CONNECTED:
			break;
		case Connection.States.QUERYING:
			switch (packet.getFixedNumber({index: 0}, 1)) {
				case 0x00:
				case 0xFF:
					this.state = Connection.States.CONNECTED;
					packet = new ParseablePacket(packet);
					if (this.listeners[0].listener) {
						this.listeners.shift().listener(packet);
					}
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
	this.conn.write(out.getBuffer(1));
};

/**
 * Selects a database.
 * 
 * @param {string} db the database to select
 * @param {function(ParseablePacket)} cb a callback to call after the query execution
 */
Connection.prototype.selectDb = function(db, cb) {
	var out = new OutgoingPacket();
	out.writeFixedNumber(0x02, 1);
	out.writeString(db, true);
	this.state = Connection.States.QUERYING;
	this.listeners.push({listener: cb, packets: [], state: Connection.Fetchstate.NONE});
	this.conn.write(out.getBuffer(0));
};

/**
 * Sends a query to the database
 * 
 * @param {string} cmd the command to send
 * @param {function(ParseablePacket)} cb a callback to call after the query execution
 */
Connection.prototype.query = function(cmd, cb) {
	var out = new OutgoingPacket();
	out.writeFixedNumber(0x03, 1);
	out.writeString(cmd, true);
	this.state = Connection.States.QUERYING;
	this.listeners.push({listener: cb, packets: [], state: Connection.Fetchstate.NONE});
	this.conn.write(out.getBuffer());
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
	for (var i=0; i < hashed.length; ++i) {
		hashed[i] = hashed[i] ^ b[i];
	}
	return hashed.toString('binary');
}

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

Connection.Fetchstate = {
	NONE: 0,
	STANDARD: 1,
	RESULTSET: 2
};

exports.Connection = Connection;
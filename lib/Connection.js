var net = require("net"),
	inherits = require("util").inherits,
	EventEmitter = require("events").EventEmitter,
	createHash = require("crypto").createHash,
	Server = require("./Server").Server,
	Packet = require("./Packet").Packet,
	OutgoingPacket = require("./OutgoingPacket").OutgoingPacket,
	HandshakePacket = require("./HandshakePacket").HandshakePacket,
	ParseablePacket = require("./ParseablePacket").ParseablePacket;

function Connection(user, password, host, port) {
	EventEmitter.call(this);
	
	if (!port) {
		port = 3306;
	}
	
	this.user = user;
	this.password = password ? createHash("sha1").update(password).digest("binary") : null;
	
	this.conn = net.createConnection(port, host);
	//this.conn.setNoDelay(true); //TODO: Change this to true if possible
	this.conn.on("data", this.data.bind(this));
}

inherits(Connection, EventEmitter);

Connection.prototype.conn = null;

Connection.prototype.user = null;

Connection.prototype.password = 0;

Connection.prototype.state = 0;

Connection.prototype.server = null;

Connection.prototype.protcolVersion = null;

Connection.prototype.data = function(data) {
	var packet = new Packet(data);
	switch (this.state) {
		case Connection.States.HANDSHAKE:
			packet = new HandshakePacket(packet);
			this.server = packet.server;
			this.authorize(packet);
			this.state = Connection.States.AUTHENTICATE;
			break;
		case Connection.States.AUTHENTICATE:
			packet = new ParseablePacket(packet);
			if (packet.fieldCount === 0x00) {
				this.state = Connection.States.CONNECTED;
				this.emit('authenticated');
			} else if (packet.fieldCount === 0xFF) {
				this.emit('error', new Error('Unable to authenticate.'), packet.errNo, packet.sqlState, packet.message);
			} else {
				this.emit('error', new Error('Got an unknown packet during authentication.'), packet);
			}
			break;
		case Connection.States.CONNECTED:
			break;
	}
};

Connection.prototype.getPacketInstance = function() {
	
};

Connection.prototype.authorize = function(packet) {
	var out = new OutgoingPacket();
	out.writeFixedNumber(Server.defaultCapabilities, 4);
	out.writeFixedNumber(4294967295, 4);
	out.writeFixedNumber(8, 1);
	out.writeFiller(23);
	out.writeNullString(this.user);
	out.writeLengthString(Connection.createScramble(packet.scramble, this.password));
	this.conn.write(out.getBuffer());
};

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
	CONNECTED: 2
};

exports.Connection = Connection;
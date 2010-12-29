var net = require('net'),
	inherits = require('util').inherits,
	EventEmitter = require('events').EventEmitter,
	HandshakePacket = require('./HandshakePacket').HandshakePacket,
	ParseablePacket = require('./ParseablePacket').ParseablePacket;

function Connection(user, password, host, port) {
	EventEmitter.call(this);
	
	if (!port) {
		port = 3306;
	}
	
	this.conn = net.createConnection(port, host);
	this.conn.setNoDelay(false); //TODO: Change this to true if possible
	this.conn.on('data', this.data.bind(this));
}

inherits(Connection, EventEmitter);

Connection.prototype.conn = null;

Connection.prototype.state = 0;

Connection.prototype.server = null;

Connection.prototype.protcolVersion = null;

Connection.prototype.data = function(data) {
	var packet;
	switch (this.state) {
		case Connection.States.HANDSHAKE:
			packet = new HandshakePacket(data);
			this.server = packet.server;
			console.log(packet.scramble);
			console.log(this.server);
			this.authorize(packet);
			this.state = Connection.States.AUTHENTICATE;
			break;
		case Connection.States.AUTHENTICATE:
			packet = new Packet(data);
			if (this.handleAuthPacket(packet) === true) {
				this.state = Connection.States.CONNECTED;
			} else {
				this.state = Connection.States.NOT_CONNECTED;
			}
			break;
		case Connection.States.CONNECTED:
			packet = new ParseablePacket(data);
			break;
	}
};

Connection.prototype.authorize = function(packet) {
	
};

Connection.prototype.handleAuthPacket = function(packet) {
	
};

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
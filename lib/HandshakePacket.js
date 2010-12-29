var inherits = require('util').inherits,
	Buffer = require('buffer').Buffer,
	Packet = require('./Packet').Packet,
	Server = require('./Server').Server;

function HandshakePacket(buffer) {
	HandshakePacket.super_.call(this, buffer);
	
	var indexWrapper = {index: null};
	this.server.protocolVersion = this.data[0];
	this.server.serverVersion = this.getString(1, indexWrapper);
	
	var index = indexWrapper.index+1;
	
	this.server.threadNr = (this.data[index+3] << 24) + (this.data[index+2] << 16) + (this.data[index+1] << 8) + this.data[index];
	index += 3;
	this.scramble = new Buffer(8 + 12);
	this.data.copy(this.scramble, 0, ++index, index+8);
	index += 9;
	this.server.capabilities = (this.data[index+1] << 8) + this.data[index++];
	this.server.charset = this.data[++index];
	this.server.status = (this.data[index+1] << 8) + this.data[index];
}

inherits(HandshakePacket, Packet);

HandshakePacket.prototype.server = new Server();

HandshakePacket.prototype.scramble = null;

exports.HandshakePacket = HandshakePacket;
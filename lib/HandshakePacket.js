var inherits = require('util').inherits,
	Packet = require('./Packet').Packet,
	Server = require('./Server').Server;

function HandshakePacket(packet) {
	this.scramble = new Buffer(8 + 12);
	this.server = new Server();
	var indexWrapper = {index: 1};
	this.server.protocolVersion = packet.getFixedNumber(indexWrapper, 1);
	this.server.serverVersion = packet.getNullString(indexWrapper);
	
	this.server.threadNr = packet.getFixedNumber(indexWrapper, 4);
	packet.data.copy(this.scramble, 0, indexWrapper.index, indexWrapper.index+8);
	indexWrapper.index += 9;
	this.server.capabilities = packet.getFixedNumber(indexWrapper, 2);
	this.server.charset = packet.getFixedNumber(indexWrapper, 1);
	this.server.status = packet.getFixedNumber(indexWrapper, 2);
	indexWrapper.index += 13;
	packet.data.copy(this.scramble, 8, indexWrapper.index, packet.data.length-1);
}

inherits(HandshakePacket, Packet);

HandshakePacket.prototype.server = null;

HandshakePacket.prototype.scramble = null;

exports.HandshakePacket = HandshakePacket;
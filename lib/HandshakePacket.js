var inherits = require('util').inherits,
	Packet = require('./Packet').Packet,
	Server = require('./Server').Server;

function HandshakePacket(packet) {
	this.scramble = new Buffer(8 + 12);
	var indexWrapper = {index: null};
	this.server.protocolVersion = packet.data[0];
	this.server.serverVersion = packet.getNullString(1, indexWrapper);
	
	var index = indexWrapper.index+1;
	
	this.server.threadNr = (packet.data[index+3] << 24) + (packet.data[index+2] << 16) + (packet.data[index+1] << 8) + packet.data[index];
	index += 3;
	packet.data.copy(this.scramble, 0, ++index, index+8);
	index += 9;
	this.server.capabilities = (packet.data[index+1] << 8) + packet.data[index++];
	this.server.charset = packet.data[++index];
	this.server.status = (packet.data[index+1] << 8) + packet.data[index++];
	index += 15;
	packet.data.copy(this.scramble, 8, index, packet.data.length-1);
}

inherits(HandshakePacket, Packet);

HandshakePacket.prototype.server = new Server();

HandshakePacket.prototype.scramble = null;

exports.HandshakePacket = HandshakePacket;
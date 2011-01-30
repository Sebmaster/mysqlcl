var Server = require("../Server").Server;

/**
 * A handshake packet
 * 
 * @constructor
 * @param {Packet} packet a packet
 */
function HandshakePacket(packet) {
	this.scramble = new Buffer(8 + 12);
	this.server = new Server();
	var indexWrapper = {index: 0};
	this.server.protocolVersion = packet.getFixedNumber(indexWrapper, 1);
	this.server.serverVersion = packet.getNullString(indexWrapper);
	
	this.server.threadNo = packet.getFixedNumber(indexWrapper, 4);
	packet.data.copy(this.scramble, 0, indexWrapper.index, indexWrapper.index+8);
	indexWrapper.index += 9;
	this.server.capabilities = packet.getFixedNumber(indexWrapper, 2);
	this.server.charset = packet.getFixedNumber(indexWrapper, 1);
	this.server.status = packet.getFixedNumber(indexWrapper, 2);
	indexWrapper.index += 13;
	packet.data.copy(this.scramble, 8, indexWrapper.index, packet.length-1);
}

/**
 * A server information object
 * 
 * @type {Server}
 */
HandshakePacket.prototype.server = null;

/**
 * The scramble of the server
 * 
 * @type {Buffer}
 */
HandshakePacket.prototype.scramble = null;

exports.HandshakePacket = HandshakePacket;
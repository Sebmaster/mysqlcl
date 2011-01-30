/**
 * A result header packet
 * 
 * @constructor
 * @param {Packet} packet a packet
 */
function HeaderPacket(packet) {
	var index = {index: 0};
	this.columns = packet.getLCBNumber(index);
	this.extra = packet.getLCBNumber(index);
}

/**
 * The number of columns in the resultset.
 * 
 * @type {number}
 */
HeaderPacket.prototype.columns = null;

/**
 * The extra.
 * 
 * @type {number}
 */
HeaderPacket.prototype.extra = null;

exports.HeaderPacket = HeaderPacket;
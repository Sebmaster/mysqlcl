/**
 * A column packet
 * 
 * @constructor
 * @param {Packet} packet the sent packet
 */
function RowPacket(packet) {
	var index = {index: 0};
	this.data = [];
	for (; index.index < packet.data.length;) {
		this.data[this.data.length] = packet.getLCBString(index);
	}
}

/**
 * The row data
 * 
 * @type {Array.<*>}
 */
RowPacket.prototype.data = null;

exports.RowPacket = RowPacket;
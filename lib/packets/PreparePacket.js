/**
 * A standard MySQL packet
 * 
 * @constructor
 * @param {Packet} packet the sent packet
 */
function PreparePacket(packet) {
	var indexWrapper = {index: 1};
	this.handleId = packet.getFixedNumber(indexWrapper, 4);
	this.columns = packet.getFixedNumber(indexWrapper, 2);
	this.parameters = packet.getFixedNumber(indexWrapper, 2);
	++indexWrapper.index;
	this.warningCount = packet.getFixedNumber(indexWrapper, 2);
}

/**
 * The type of the packet
 * 
 * @type {number}
 */
PreparePacket.prototype.fieldCount = 0x00;

/**
 * The ID of the prepared statement
 * 
 * @type {number}
 */
PreparePacket.prototype.handleId = null;

/**
 * The number of columns in the result set
 * 
 * @type {number}
 */
PreparePacket.prototype.columns = null;

/**
 * The number of parameters in the query
 * 
 * @type {number}
 */
PreparePacket.prototype.parameters = null;

/**
 * The number of warnings
 * 
 * @type {number}
 */
PreparePacket.prototype.warningCount = null;

exports.PreparePacket = PreparePacket;
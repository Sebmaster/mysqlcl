/**
 * A standard MySQL packet
 * 
 * @constructor
 * @param {Packet} packet the sent packet
 */
function ParseablePacket(packet) {
	var indexWrapper = {index: 0};
	this.fieldCount = packet.getFixedNumber(indexWrapper, 1);
	switch (this.fieldCount) {
		case 0x00:
			this.modifiedRows = packet.getLCBNumber(indexWrapper);
			this.insertId = packet.getLCBNumber(indexWrapper);
			this.serverStatus = packet.getFixedNumber(indexWrapper, 2);
			this.warningCount = packet.getFixedNumber(indexWrapper, 2);
			this.message = packet.getFixedString(indexWrapper, packet.length-indexWrapper.index);
			break;
		case 0xFF:
			this.errNo = packet.getFixedNumber(indexWrapper, 2);
			++indexWrapper.index;
			this.sqlState = packet.getFixedString(indexWrapper, 5);
			this.message = packet.getFixedString(indexWrapper, packet.length-indexWrapper.index);
			break;
		default:
			throw "Got an unknown packet!";
	}
}

/**
 * The type of the packet
 * 
 * @type {number}
 */
ParseablePacket.prototype.fieldCount = null;

/**
 * The server message
 * 
 * @type {string}
 */
ParseablePacket.prototype.message = null;

// OK-Packet
/**
 * The number of modified rows
 * 
 * @type {number}
 */
ParseablePacket.prototype.modifiedRows = 0;

/**
 * The last insert id with AUTO_INCREMENT
 * 
 * @type {number}
 */
ParseablePacket.prototype.insertId = 0;

/**
 * The server status (autocommit-mode?)
 * 
 * @type {number}
 */
ParseablePacket.prototype.serverStatus = null;

/**
 * The number of warnings raised by the last query
 * 
 * @type {number}
 */
ParseablePacket.prototype.warningCount = 0;

// ERR-Packet
/**
 * The number of the error
 * 
 * @type {number}
 */
ParseablePacket.prototype.errNo = null;

/**
 * The sql state
 * 
 * @type {string}
 */
ParseablePacket.prototype.sqlState = null;

exports.ParseablePacket = ParseablePacket;
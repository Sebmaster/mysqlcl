/**
 * A column packet
 * 
 * @constructor
 * @param {Packet} packet the sent packet
 */
function ColumnPacket(packet) {
	var index = {index: 0};
	this.catalog = packet.getLCBString(index);
	this.db = packet.getLCBString(index);
	this.table = packet.getLCBString(index);
	this.tableAS = packet.getLCBString(index);
	this.name = packet.getLCBString(index);
	this.nameAS = packet.getLCBString(index);
	++index.index;
	this.charset = packet.getFixedNumber(index, 2);
	this.length = packet.getFixedNumber(index, 4);
	this.type = packet.getFixedNumber(index, 1);
	this.flags = packet.getFixedNumber(index, 2);
	this.decimals = packet.getFixedNumber(index, 1);
	index.index += 2;
	this.defaults = packet.getLCBNumber(index);
}

/**
 * Catalog of the database
 * 
 * @type {string}
 */
ColumnPacket.prototype.catalog = null;

/**
 * The database of the column
 * 
 * @type {string}
 */
ColumnPacket.prototype.db = null;

/**
 * The table of the column (after AS)
 * 
 * @type {string}
 */
ColumnPacket.prototype.table = null;

/**
 * The table of the column (before AS)
 * 
 * @type {string}
 */
ColumnPacket.prototype.tableAS = null;

/**
 * The name of the column (after AS)
 * 
 * @type {string}
 */
ColumnPacket.prototype.name = null;

/**
 * The name of the column (before AS)
 * 
 * @type {string}
 */
ColumnPacket.prototype.nameAS = null;

/**
 * The charset of the column
 * 
 * @type {number}
 */
ColumnPacket.prototype.charset = null;

/**
 * The length of the column
 * 
 * @type {number}
 */
ColumnPacket.prototype.length = null;

/**
 * The type of the column
 * 
 * @type {number}
 */
ColumnPacket.prototype.type = null;

/**
 * The flags of the column
 * 
 * @type {number}
 */
ColumnPacket.prototype.flags = null;

/**
 * The decimals of the column
 * 
 * @type {number}
 */
ColumnPacket.prototype.decimals = null;

/**
 * The default of the column
 * 
 * @type {string}
 */
ColumnPacket.prototype.defaults = null;

exports.ColumnPacket = ColumnPacket;
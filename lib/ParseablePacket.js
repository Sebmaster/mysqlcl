function ParseablePacket(packet) {
	var indexWrapper = {index: 0};
	this.fieldCount = packet.getFixedNumber(indexWrapper, 1);
	switch (this.fieldCount) {
		case 0x00:
			this.modifiedRows = packet.getLCBNumber(indexWrapper);
			this.insertId = packet.getLCBNumber(indexWrapper);
			this.serverStatus = packet.getFixedNumber(indexWrapper, 2);
			this.warningCount = packet.getFixedNumber(indexWrapper, 2);
			this.message = packet.getFixedString(indexWrapper, packet.data.length-indexWrapper.index);
			break;
		case 0xFF:
			this.errNo = packet.getFixedNumber(indexWrapper, 2);
			++indexWrapper.index;
			this.sqlState = packet.getFixedString(indexWrapper, 5);
			this.message = packet.getFixedString(indexWrapper, packet.data.length-indexWrapper.index);
			break;
		default:
			throw "Got an unknown packet!";
	}
}

ParseablePacket.prototype.fieldCount = null;

ParseablePacket.prototype.message = null;

// OK-Packet
ParseablePacket.prototype.modifiedRows = null;

ParseablePacket.prototype.insertId = null;

ParseablePacket.prototype.serverStatus = null;

ParseablePacket.prototype.warningCount = null;

// ERR-Packet
ParseablePacket.prototype.errNo = null;

ParseablePacket.prototype.sqlState = null;

exports.ParseablePacket = ParseablePacket;
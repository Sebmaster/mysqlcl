function ParseablePacket(packet) {
	var indexWrapper = {index: 0};
	this.fieldCount = packet.getFixedNumber(indexWrapper, 1);
	switch (this.fieldCount) {
		case 0x00:
			
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

ParseablePacket.prototype.errNo = null;

ParseablePacket.prototype.sqlState = null;

ParseablePacket.prototype.message = null;

exports.ParseablePacket = ParseablePacket;
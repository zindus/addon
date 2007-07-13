// This class helps to pass data to/from parent + child windows as a parameter to window.openDialog()
//
function Payload(opcode)
{
	this.m_opcode = opcode;
	this.m_args   = null;
	this.m_result = null;
}

// Payload.SYNC        = 0;
// Payload.AUTHONLY    = 1;

Payload.prototype.opcode = function()
{
	return this.m_opcode;
}

Payload.prototype.toString = function()
{
	var msg = "";

	msg += "opcode: " + this.m_opcode;
	msg += " m_args: "   + ((this.m_args   != null) ? this.m_args.toString()   : "null");
	msg += " m_result: " + ((this.m_result != null) ? this.m_result.toString() : "null");

	return msg;
}

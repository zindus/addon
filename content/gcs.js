// gcs == Global Converged State
//

Gcs.WIN      = 0; // item didn't change, or item changed in one source
Gcs.CONFLICT = 1; // item changed in more than one source

Gcs.bimap_state = new BiMap(
	[Gcs.WIN, Gcs.CONFLICT],
	['win',   'conflict', ]);


function Gcs(sourceid_winner, state)
{
	this.sourceid_winner = sourceid_winner;
	this.state           = state;
}

Gcs.prototype.toString = function()
{
	return  "winner: " + this.sourceid_winner +
			" state: " + Gcs.bimap_state.lookup(this.state);
}

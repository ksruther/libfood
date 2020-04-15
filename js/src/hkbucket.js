// Class for a hoodnet k-bucket
class Hkbucket {
	constructor({size} = {}) {
		// TODO: If no size, throw error
		this.size = size;
		this.data = []
	}

	exists(node_info) {
		for (let i = 0; i < this.data.length; i += 1) {
			if (this.data[i].node_id === node_info.node_id) {
				return i;
			}
		}

		return null;
	}

	move_to_tail(i) {
		this.data.push(this.data.splice(i, 1)[0]);
	}

	is_full() {
		return this.data.length >= this.size;
	}
}

module.exports.Hkbucket = Hkbucket;
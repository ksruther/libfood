# libfood

libfood is the reference implementation of Free Food, a decentralized location-aware p2p protocol to make food delivery fair again (and make Grubhub obsolete).

**libfood is in active development. There will be bugs, security issues, missing features, etc.**

As the Wall Street Journal and others have reported, [the largest centralized food delivery platforms in the world are planning to stop providing delivery services](https://www.wsj.com/articles/strategy-behind-blockbuster-grubhub-deal-dont-deliver-11593266407) -- focusing instead on providing nothing more to consumers than an aggregated ordering interface. For this "service," which is to merely relay each customer's order to the restaurant which must fulfill it, corporations like Grubhub charge restaurants 30% per order. This far exceeds the profit margins of a typical restaurant.

The goal of Free Food is to provide this function as a protocol rather than a platform, eliminating the middleman by enabling the world's restaurants to effortlessly self-organize as a decentralized marketplace. In other words: **Free Food lets you search for nearby restaurants, view their menus, and place an order with one click -- but without paying fees to a parasitic third party delivery platform.**

### Technology overview
Location-aware peer discovery is accomplished primarily through the use of a Morton-order curve and a prefix hash tree, a distributed data structure which enables efficient range queries of a distributed hash table.

The network is secured using several mechanisms: Resource providers participate in a distributed system of peer-signed certificates -- i.e., a "web of trust." A restaurant's trustworthiness is based on the number of signatures it has received from other restaurants and other features of the trust graph topology. This system exploits the simple observation that restaurant owners tend to know and cooperate with other local restaurant owners.

Free Food has a distributed keyserver built atop a distributed ledger; the protocol includes a generalized distributed ledger with a stack-based virtual machine for executing arbitrary contracts, based largely on the design of the Bitcoin blockchain.

Identity creation for resource providers is made costly with a computational proof-of-work mechanism based on the partial preimage discovery first employed by Hashcash. Taking inspiration from systems used to verify real world identities on messageboards like Reddit -- as well as the anti-catfishing systems employed by Tinder and Bumble -- Free Food requires resource providers to supply a photographic proof of identity which includes a unique symbol which is mathematically bound to the proof-of-work associated with their public key.

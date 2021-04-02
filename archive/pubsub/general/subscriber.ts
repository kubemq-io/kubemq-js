import {PubSubSettings, StoreProperties} from "../../interfaces";
import {PubSub} from "../pubsub";

export class Subscriber extends PubSub {
	constructor(settings: PubSubSettings) { super(settings) }

	subscribe(reqHandler: (...args: any[]) => void, errorHandler: (...args: any[]) => void, storeProperties?: StoreProperties) {
		super.subscribe(reqHandler, errorHandler,storeProperties);
	}

	unsubscribe() {
		super.unsubscribe();
	}
}

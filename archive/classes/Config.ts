import * as dotenv from 'dotenv';

if (!process.env['ENV_LOADED']) {
	dotenv.config();
	process.env['ENV_LOADED'] = 'TRUE';
}

export class Config {
	static get(key: string, def?: any) {
		const Val = process.env[key];
		if (Val && !isNaN(Number(Val)) && Val.length < 16) return Number(Val);
		else return Val !== '' && Val || def;
	}
}

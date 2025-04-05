"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class BUHTA {
    postDBLoad(container) {
        const logger = container.resolve("WinstonLogger");
        const db = container.resolve("DatabaseServer").getTables();

        this.pkg = require("../package.json");
        const config = require("../config/config.json");

        logger.log(`[${this.pkg.name}] Loaded v${this.pkg.version} for AKI v${this.pkg.sptVersion}! Made by ${this.pkg.author}.`, "cyan");
		
		const ammoParent = "5485a8684bdc2da71d8b4567";
		const items = db.templates.items;
		
		//console.log(Object.keys(db.locales.global.en))
		const getName = (key)=>db.locales.global.en[key];
		
		const calibersArr = Object.keys(db.templates.items).filter(i=>items[i]._parent === ammoParent).map(a=>({penetrationPower:items[a]._props.PenetrationPower, id: a, caliber: items[a]._props.Caliber, price: db.templates.handbook.Items.find(i=>i.Id===a)?.Price, name: getName(a+" Name")}));
		
		const caliberObj = {};
		calibersArr.map(c=>caliberObj[c.caliber]=[]);
		Object.keys(caliberObj).map(cName=>{
			caliberObj[cName].push(...calibersArr.filter(c=>c.caliber === cName))
		});
		
		Object.keys(caliberObj).map(cName=>{
			if (caliberObj[cName] && caliberObj[cName].length){
				caliberObj[cName].sort((a,b)=>b.penetrationPower - a.penetrationPower)
			}
			
			if (caliberObj[cName]?.length && caliberObj[cName].penetrationPower === 0 ){
				caliberObj[cName].caliberObj[cName].sort((a,b)=>b.price - a.price)
			}else{
				const getByPower = p => caliberObj[cName].filter((a=>a.penetrationPower>p));
				
				let filtered = getByPower(40);
				if (!filtered.length) filtered = getByPower(30);
				if (!filtered.length) filtered = caliberObj[cName]
					
				caliberObj[cName] = filtered;
			}
			
			caliberObj[cName] = caliberObj[cName].map(c=>c.id).splice(0,4);
		});
		
		//print best ammo		
		/*Object.keys(caliberObj).map(n=>{
			console.log(n);
			caliberObj[n].map(b=>console.log("  " + getName(b + " Name")));
		});*/
		
		const ignoreBotTypes = [
		"ravangezryachiyevent", "spiritspring", "spiritwinter", "infectedcivil","infectedassault","infectedlaborant","infectedpmc","infectedtagilla","", "test", "gifter"];
		
		ignoreBotTypes.push(...(!config.bloodhound? ["arenafighter", "arenafighterevent"] : []));
		ignoreBotTypes.push(...(!config.exusec? ["exusec"] : []));
		ignoreBotTypes.push(...(!config.raider? ["pmcbot"] : []));
		ignoreBotTypes.push(...(!config.sectant? ["sectactpriestevent", "sectantoni", "sectantpredvestnik", "sectantpriest", "sectantwarrior", "sectantprizrak"] : []));
		
		const botTypes = Object.keys(db.bots.types).filter(k=>!ignoreBotTypes.includes(k))
		.filter(t=>{
			return db.bots.types[t].health?.BodyParts?.filter(h=>h.Chest.max>130)?.length
		});
		
		//print affected bots
		//console.log(botTypes)
		
		const getMaxBodyHP = (b)=> {
			const hp = b.health?.BodyParts?.filter(h=>h.Chest.max>130);
			return Math.max(...(hp.map(bodyParts=>bodyParts.Chest.max)));
		};
		const chestHealthArray = botTypes.map(b=>{
			return getMaxBodyHP(db.bots.types[b]);
		});
		
		const minHealth = Math.min(...chestHealthArray);
		const maxHealth = Math.max(...chestHealthArray);
		const rangeHealth = Math.round((maxHealth - minHealth) * .8);
		const multiplyWeight = 1000;
		
		const getWeights = (count)=>{
			if (count ===0 ) return [];
			if (count ===1 ) return [1*multiplyWeight];
			const arr = Array(count).fill(0).map((a,i)=>((i+1)/(count-1)+.2) );
			
			arr.push(...[...arr].reverse().slice(1));
			return arr.map(w=>Math.round(w*multiplyWeight));
		};
		
		const weights = Array(6).fill(0).map((a,i)=>getWeights(i));
		
		//console.log(weights);
		
		const getWeigthAmmoByCount = (idsArray, percentage)=>{
			const maxIndex = Math.round(idsArray.length*percentage);
			const from = Math.max(0, maxIndex - 1);
			const to =  Math.max(1, maxIndex - 1 + idsArray.length)
			const weight = weights[idsArray.length].slice(from,to);
			const obj = {};
			
			//console.log({ammoX:idsArray.length, from, to, weight});
			
			weight.forEach((w,i)=>obj[idsArray[i]]=w);
			
			return obj;
		};
		
		botTypes.forEach(t=>{
			const bot = db.bots.types[t];
			
			const ammo = bot?.inventory?.Ammo
			if (!ammo) return;
			
			const chestHealth = getMaxBodyHP(bot);
			
			let percentHp = (chestHealth - minHealth)/rangeHealth;
			const isBoss = t.toLowerCase().includes('boss') || percentHp > 0.5;
			percentHp = isBoss? 1 : percentHp;
			
			const calibers = Object.keys(ammo);
			calibers.forEach(c=>{
				if (!caliberObj[c]) {
					console.log('not found ammo for '+c);
					return;
				}
				ammo[c] = getWeigthAmmoByCount(caliberObj[c],percentHp)
			});
		});
    }
}

module.exports = { mod: new BUHTA() };
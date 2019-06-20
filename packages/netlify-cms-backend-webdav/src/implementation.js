import AuthenticationPage from './AuthenticationPage';

export default class WebDAVBackend {
	constructor(config,options = {}) {
		//console.log("config",config);
		//console.log("options",options);

		this.url=this.withTrailingSlash(
			config.get("backend").get("url")
		);

		// null auth initially
		this.auth=null;

		if ("undefined"===this.url) {
			throw new Error("URL is not defined in config.yml for the WebDAV backend");
		}
		
		// Unimplemented methods during DEV
		for (let m of [
			//'authComponent',
			//'restoreUser',
			//'authenticate',
			'logout',
			'getToken',
			'traverseCursor',
			//'entriesByFolder',
			'entriesByFiles',
			//'getEntry',
			//'persistEntry',
			'unpublishedEntries',
			'unpublishedEntry',
			'deleteUnpublishedEntry',
			'updateUnpublishedEntryStatus',
			'publishUnpublishedEntry',
			//'getMedia',
			'persistMedia',
			'deleteFile'
		]) {
			this[m]=(...args) => { console.log(m,args); throw new Error(m); }
		}
	}

	// internal
	withTrailingSlash(url) {
		// check for trailing slash, if not add it!
		if ( ! (/\/$/.exec(url)) ) {
			return url+"/";
		}
		return url;
	}

	// internal
	makeAuthHeader(auth) {
		if (auth.username==="" && auth.password==="") {
			return {};
		} else {
			return {'Authorization':'Basic '+btoa(auth.username+":"+auth.password)};
		}
	}

	// internal
	makeAuthOpts(auth,method) {
		return {
			method,
			credentials:"omit",
			cache:"no-store",
			headers:this.makeAuthHeader(auth),
		};
	}

	restoreUser() {
		return Promise.reject();
	}

	authComponent() {
		return AuthenticationPage;
	}

	async authenticate(userobj) {
		// userobj has {username:string,password:string}
		
		const opts=this.makeAuthOpts(userobj,"GET");
		const result = await fetch(this.url,opts);
		if (result.status===401) {
			throw new Error("Incorrect username or password");
		} else if (!result.ok) {
			throw new Error("fetch problem:"+result.status+" "+result.statusText);
		}
		
		// OK, store auth for other requests.
		this.auth=userobj;
		
		return;
	}

	// internal
	async propFind(url,depth) {
		const opts=this.makeAuthOpts(this.auth,"PROPFIND");
		opts.headers.Depth=depth;
		const result = await fetch(url,opts);
		if (!result.ok)
			throw new Error("Fetch problem:"+result.status+" "+result.statusText);
		const resultBodyText=await result.text();
		const xmlDoc=new DOMParser().parseFromString(resultBodyText,"text/xml");

		let listing=[];
		for (let response of xmlDoc.getElementsByTagNameNS("DAV:","response")) {
			let href=response.getElementsByTagNameNS("DAV:","href");
			if (!href.length)
				continue;
			let name=href[0].textContent;
			let coll=response.getElementsByTagNameNS("DAV:","collection");
			listing.push({name,collection:coll.length!=0});
		}
		return listing;
	}
	
	async propFindExt(url,ext) {
		const prefix=await this.propFind(url,0);
		const listing=await this.propFind(url,1);
		return (listing
			.filter( (item)=>item.name.endsWith(ext) )
			.map( (item)=>({name:item.name.substring( prefix[0].name.length ) }) )
		);
	}

	async entriesByFolder(collection, ext) {
		const configFolder = collection.get('folder');
		const url=this.url+this.withTrailingSlash(configFolder);

		const entriesByName = await this.propFindExt(url,".md");

		// NO LAZY LOADING RIGHT NOW...
		const out = [];
		for (let wName of entriesByName) {
			const path=this.withTrailingSlash(configFolder)+wName.name;
			out.push( await this.getEntry(collection,"",path) );
		}

		return out;
	}
	async getMedia() {
		return []; //{file:{path:"Third"}},{file:{path:"Fourth"}}]
	}

	async getEntry(collection,slug,path) {
		const opts=this.makeAuthOpts(this.auth,"GET");
		const result=await fetch(this.url+path,opts);
		if (!result.ok)
			throw new Error("GET problem on "+path+":"+result.status+" "+result.statusText);
		const body=await result.text(); // TODO: images?
		return {
			file: { path },
			data: body
		};
	}
	async persistEntry(entry, mediaFiles, options = {}) {
		// options.useWorkflow
		// options.parsedData options.parsedData.title  options.parsedData.description
		// options.collectionName
		// options.initialWorkflowStatus
		
		// options.newEntry <- important!!
		
		const opts=this.makeAuthOpts( this.auth, "PUT" );
		opts.body=entry.raw;
		const result=await fetch(this.url+entry.path,opts);
		if (!result.ok)
			throw new Error("PUT problem on "+path+":"+result.status+" "+result.statusText);
		return;
	}

}

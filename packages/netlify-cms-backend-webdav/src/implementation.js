import { EditorialWorkflowError, Cursor, CURSOR_COMPATIBILITY_SYMBOL } from 'netlify-cms-lib-util';
import AuthenticationPage from './AuthenticationPage';

const maybe=(...args)=>{
	if (args.length===0)
		return undefined;
	let value=args[0];
	for (let i=1;i<args.length && value;i++)
		value=args[i](value);
	return value;
};

export default class WebDAVBackend {
	constructor(config,options = {}) {
		//console.log("config",config);
		//console.log("options",options);

		this.url=this.withTrailingSlash(
			config.get("backend").get("url")
		);
		this.mediaFolder=this.withTrailingSlash(
			config.get("media_folder")
		);
		this.publicFolder=maybe(
			config.get("public_folder"),
			path=>this.withTrailingSlash(path)
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
			//'logout',
			'getToken',
			'traverseCursor',
			//'entriesByFolder',
			//'entriesByFiles',
			//'getEntry',
			//'persistEntry',
			'unpublishedEntries',
			//'unpublishedEntry',
			'deleteUnpublishedEntry',
			'updateUnpublishedEntryStatus',
			'publishUnpublishedEntry',
			//'getMedia',
			//'persistMedia',
			//'deleteFile'
		]) {
			this[m]=(...args) => { console.log(m,args); throw new Error(m); }
		}
	}

	// internal
	withTrailingSlash(url) {
		// check for trailing slash, if not add it!
		if ( ! url.endsWith("/")) { // (/\/$/.exec(url)) ) {
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

	logout() {
		this.auth = null;
		return null;
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
			let path=href[0].textContent;
			let coll=response.getElementsByTagNameNS("DAV:","collection");
			listing.push({path,label:path,collection:coll.length!=0});
		}
		return listing;
	}
	
	async propFindExt(url,ext) {
		const prefix=await this.propFind(url,0);
		const listing=await this.propFind(url,1);
		return (listing
			.filter( (item)=>item.path.endsWith(ext) )
			.map( (item)=>({...item,path:item.path.substring( prefix[0].path.length ) }) )
		);
	}

	// internal
	async fetchFilesToEntries(collection,files) {
		const configFolder = collection.get('folder');
		// NO LAZY LOADING RIGHT NOW...
		const out = [];
		for (let file of files) {
			const path=(configFolder?this.withTrailingSlash(configFolder):"")+file.path;
			let entry;
			try {
				entry=await this.getEntry(collection,"",path);
			} catch (e) {
				console.log(e);
				continue;
			}
			out.push( {...entry,file:{...file,...entry.file}} ); 
		}

		return out;
	}

	async entriesByFolder(collection, ext) {
		const configFolder = collection.get('folder');
		const url=this.url+this.withTrailingSlash(configFolder);

		const files = await this.propFindExt(url,".md");

		return await this.fetchFilesToEntries(collection,files);
	}
	async entriesByFiles(collection) {
		const configFolder = collection.get('folder');
		const files = collection.get('files').map( collectionFile => ({
			path: collectionFile.get('file'),
			label: collection.get('label')
		}));
		return await this.fetchFilesToEntries( collection, files );
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

	async persistMedia({fileObj}) {
		const { name, size } = fileObj;
		const path = this.mediaFolder+name;
		const uurl = this.url+path;
		const opts=this.makeAuthOpts( this.auth, "PUT" );
		opts.body=fileObj;
		const result = fetch( uurl, opts );
		const purl = this.publicFolder?this.publicFolder+name:uurl;
		const assetInfo = { id: path, name, size, path, url: purl };
		
		return assetInfo;
	}

	async deleteFile(path,info,collection) {
		const opts=this.makeAuthOpts( this.auth, "DELETE" );
		const result=await fetch(this.url+path,opts);
		if (!result.ok)
			throw new Error("DELETE problem on "+path+":"+result.status+" "+result.statusText);
		return;
	}

	async getMedia() {
		const mediaUrl = this.url+this.mediaFolder;
		const mediaFiles = await this.propFind(mediaUrl,1);
		//console.log(mediaFiles);
		const relMediaFiles = mediaFiles
			.map( item=>{
				const uurl = item.path;
				const name = uurl.substring(mediaUrl.length);
				const path = this.mediaFolder+name;
				const purl = this.publicFolder?this.publicFolder+name:uurl;
				return {
					...item,
					id:path,
					path,
					name,
					size:0,
					url: purl
				}})
			.filter( item=>(!item.collection) );
		//console.log(relMediaFiles);
		return relMediaFiles; //{file:{path:"Third"}},{file:{path:"Fourth"}}]
	}


	async unpublishedEntry(collection, slug) {
		throw new EditorialWorkflowError('content is not under editorial workflow',true);
	}
}

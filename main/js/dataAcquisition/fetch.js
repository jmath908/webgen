
createDb = (name = 'api-cache.db') => {
    if (loki !== 'undefined') {
        return new loki(name, {
            adapter: new LokiIndexedAdapter(),
        })
    } else {
        console.error('Loki library is not loaded in properly.')
        return null
    }
}

databaseInitialize = () => {
    if (db) {
        let queries = db.getCollection('queries')
        if (!queries) {
            db.addCollection('queries')
        }
    } else {
        throw 'Loki library is not loaded in properly.'
    }
}

lokiFetch = async (url) => {
    if (db) {
        let queries = db.getCollection('queries')
        let apiCall = await queries.findOne({
            url
        })
        if (apiCall) {
            if (Math.floor(new Date().getTime() / 1000.0) - apiCall.dt >= 1209600) {
                return await lokiRefetch(url)
            } else {
                return apiCall.data
            }
        } else {
            return await lokiRefetch(url)
        }
    } else {
        console.warn('Loki library is not loaded in properly, no caching available.')
        return await (await fetch(url)).json()
    }
}

lokiRefetch = async (url) => {
    let queries = db.getCollection("queries")
    try {
        let result = await (await fetch(url)).json()
        queries.insert({
            url,
            data: result,
            dt: Math.floor(new Date().getTime() / 1000.0)
        })
        db.saveDatabase((err) => {
            if (err) {
                console.error(err)
            }
        })
        return result
    } catch (e) {
        console.error(e)
        return {}
    }
}

lokiTest = () => {
    let queries = db.getCollection("queries")
    let queriesCount = queries.count()

    queries.insert({ url: 'localhost', data: [{ asdf: 'asdf' }], dt: Math.floor(new Date().getTime() / 1000.0) })
    queriesCount = queries.count()

    console.log("old number of entries in database : " + queriesCount)
    db.saveDatabase((err) => {
        if (err) {
            console.error(err)
        } else {
            console.log("saved... it can now be loaded or reloaded with up to date data")
        }
    })
}

db = createDb()

if (db) {
    db.loadDatabase({}, () => {
        try {
            databaseInitialize()
        } catch (_) {
            console.error(_)
        }
    })
} else {
    console.error('Loki library is not loaded in properly.')
}


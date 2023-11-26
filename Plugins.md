// notation:
manifest_function
@tag
!symbol
$fileProperty
neshto? - po jelanie

manifest()
	vrushta obj{
		id (!= "null"), name, description, version, tags, symbols,
		webSymbols?
	}

tags:   ["@t1", "@t2", "@t3"]
tags:   @fileAdder -> !request
	    @webSymbols -> webSymbols
	    @fileViewer -> @webSymbols, !viewFile, !fileViewerPred
			            !viewFile in webSymbols
	
symbols: {"symbol": "C:Users/...", "otherSymbol": "C:/", ...}
trqbva da sa module.exports-nati ot suotvetniq file

webSymbols: ["websymbol", "otherWebSymbol", ...]
	tezi, koito sa accessable ot client-a

!request: function(uri, tmpFileId, $pluginData?(reference))
	tegli v ./tmp/${tmpFileId}, 
	vrushta {hash, type}
	bara $pluginData?
	ako $pluginData.viewWith - izbira tozi !viewFile direktno => @fileViewer

!viewFile: client-side function(file // ot db) =>
	tam vizualizira neshto, nz
	

!fileViewerPred: function(file // ot db) => 
	vrushta true, ako iskame by default da displayvame tozi file s tozi viewer
	ако няма $pluginData.viewWith, взима първия, който иска файла
	ако пак няма, дефолт

/api/plugins - spisuk na manifestite, bez symbols
/api/pluginSymbol?tag - vrushta webSymbol, filter s tag
/api/getFileViewer?id - vrushta file viewer za id
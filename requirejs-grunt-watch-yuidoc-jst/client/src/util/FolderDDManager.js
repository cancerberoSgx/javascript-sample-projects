
//html5 folder drag and drop manager

define('FolderDDManager', [], function() {

  window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
  window.resolveLocalFileSystemURL = window.webkitResolveLocalFileSystemURL ||
    window.webkitResolveLocalFileSystemURL;

  /**
   * a FolderDDManager instance can be installed on a DOm Element and mange all the files 
   * (recursively) contained in a droped folder by the user. Then it will work for collecting 
   * all the file contents and returns (async) a structure of all the files. It will detect and 
   * not extract content of binary files. 
   * @class FolderDDManager
   */
  var FolderDDManager = function () {};
  var proto = FolderDDManager.prototype;

  proto.error = function (e ) {  
    console.log('error', e);
  };
  proto.error_from_readentries= function(e) {
    console.log('error_from_readentries', e);
  };
  proto.traverseFileTree=function (item, path) {
    path = path || "";
    var self = this;
    if (item.isFile) {
        // Get file
        item.file(function(file) {
            // console.log("File: " + path + file.name);
            self.readFileText(file); 
        }, _.bind(self.error, self));
    } else if (item.isDirectory) {
        // Get folder contents
        var dirReader = item.createReader();
        dirReader.readEntries(function(entries) {
          if(entries)
            for (var i=0; i<entries.length; i++) {
                self.traverseFileTree(entries[i], path + item.name + "/"); 
            }
        }, _.bind(self.error_from_readentries, self));
    } 
  };
  /**
  @method isBinary
  */
  proto.isBinary = function(str) {
    //we guess by comparing form 3rd char to 100 for if charcode>=65533
    if(str.length<3) {
      return false; //the problem are big binary files. 
    }
    for (var i = 2; i < Math.min(str.length-1, 100); i++) {
      if(str.charCodeAt(i)>=65533) {
        return true;
      }
    }
    return false;
  }; 
  /**
  @method readFileText
  */
  proto.readFileText = function(file) {
    var reader = new FileReader();
    var self = this;
    reader.readAsText(file); 
    reader.addEventListener('loadend', function(e, file) {
      var isBinary = self.isBinary(reader.result);
      // if(isBinary) {
      //   console.log('BINARYFILE');
      // }
      // else {
      //   console.log(this.result); 
      // }
    });
  }; 
  proto.handleDrop = function(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    // debugger;
    var items = evt.dataTransfer.items || evt.dataTransfer.files ;
    for (var i = 0; i < items.length; i++) {
        var item = items[i].webkitGetAsEntry();
        if (item) {
            this.traverseFileTree(item);
        }
    }
  }; 

  proto.handleDragOver = function(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy';
  }; 
  /**
  @method install 
  @param el HTMLElement
  @param listener Function
  */
  proto.install = function(el, listener) {    
    /**
    @property listener
    */
    this.listener=listener;
    el.addEventListener("drop", _.bind(this.handleDrop, this), false);
    el.addEventListener("dragover", _.bind(this.handleDragOver, this), false);
  }; 

  return FolderDDManager;
});

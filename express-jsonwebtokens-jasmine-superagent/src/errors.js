
var templates = require('./templates');
function registerErrorHandlers(app)
{
  // catch 404 and forward to error handler
  app.use(function(req, res, next) {console.log('throws?')
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  // development error handler will print stacktrace
  if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
      res.status(err.status || 500);
      var context = {
        message: err.message,
        error: err
      }; 
      templates.render('error.html', context, res);
    });
  }
}

module.exports = {
  registerErrorHandlers: registerErrorHandlers
}
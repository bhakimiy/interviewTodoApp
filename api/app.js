const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();

const { mongoose } = require('./db/mongoose');

const bodyParser = require('body-parser');

// Load in the mongoose models
const { List, Task, User } = require('./db/models')

/** MIDDLEWARE **/

// Load middleware
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());


// CORS HEADERS MIDDLEWARE
app.use(function(req, res, next) {
   res.header("Access-Control-Allow-Origin", "*");
   res.header("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS, PUT, PATCH, DELETE");
   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-access-token, x-refresh-token, _id");

   res.header(
       'Access-Control-Expose-Headers',
       'x-access-token, x-refresh-token'
   );

   next();
});

// check whether the request has a valid JWT access token
let authenticate = (req, res, next) => {
   let token = req.header('x-access-token');

   // verify the jwt
   jwt.verify(token, User.getJWTSecret(), (err, decoded) => {
      if (err) {
         res.status(401).send(err);
      } else {
         req.user_id = decoded._id;
         next();
      }
   });
};

// Verify Refresh Token Middleware (which will be verifying the session)
let verifySession = (req, res, next) => {
   // grab the refresh token from the header
   let refreshToken = req.header('x-refresh-token')

   // grab the _id fro the request header
   let _id = req.header('_id');

   User.findByIdAndToken(_id, refreshToken).then((user) => {
      if (!user) {
         // user couldn't be found
         return Promise.reject({
            'error': 'User not found.'
         });
      }

      req.user_id = user._id;
      req.userObject= user;
      req.refreshToken = refreshToken;

      let isSessionValid = false;

      user.sessions.forEach((session) => {
         if (session.token === refreshToken) {
            if (User.hasRefreshTokenExpired(session.expiresAt) === false) {
               // refresh token has not expired
               isSessionValid = true;
            }
         }
      });

      if (isSessionValid) {
         // the session is valid
         next();
      } else {
         // the session is not valid
         return Promise.reject({
            'error': 'Refresh token has expired or the token is not vaild'
         });
      }

   }).catch((e) => {
      res.status(401).send(e);
   })
};

/** END MIDDLEWARE **/

/* ROUTE HANDLERS */

//region List Routes

/* START LIST ROUTES */
/**
 * GET /lists
 * Purpose: Get all lists
 */
app.get('/lists', authenticate, (req, res) => {
   //Returns the array of all the lists in the database that belong to the authenticated user
   List.find({
      _userId: req.user_id
   }).then((lists) => {
      res.send(lists);
   }).catch((e) => {
      res.send(e);
   });
});

/**
 * POST /lists
 * Purpose: Create a list
 */
app.post('/lists', authenticate, (req, res) => {
   // Here we create a new list and return the new list document back to the user with id
   // The list information (fields) will be passed in via the JSON request body
   let title = req.body.title;
   let newList = new List({
      title,
      _userId: req.user_id
   });

   newList.save().then((listDoc) => {
      // The full list document is returned (incl. id)
      res.send(listDoc);
   });
});

/**
 * PATCH /lists/:id
 * Purpose: Update a specified list
 */
app.patch('/lists/:id', authenticate, (req, res) => {
    // Here we update the specified list (list document with id in the URL) with the new values specified in the JSON request body
   List.findOneAndUpdate({_id: req.params.id, _userId: req.user_id}, {
      $set: req.body
   }).then(() => {
      res.send({'message': 'updated successfully'});
   });
});

/**
 * DELETE /lists/:id
 * Purpose: Delete a list
 */
app.delete('/lists/:id', authenticate, (req, res) => {
    // Here we delete the specified list (document with id in the URL)
   List.findOneAndRemove({
      _id: req.params.id,
      _userId: req.user_id
   }).then((removedListDocument) => {
      res.send(removedListDocument);

      // delete all the tasks of this list
      deleteTasksFromList(removedListDocument._id);
   });
});

/**
 * GET /lists/:listId/tasks
 * Purpose: Get all tasks in a specific list
 */
app.get('/lists/:listId/tasks', authenticate, (req, res) => {
   // We want to return all tasks that belong to a specific list (specified by listId)
   Task.find({
      _listId: req.params.listId
   }).then((tasks) => {
      res.send(tasks);
   })
});

/**
 * POST /lists/:listId/tasks
 * Purpose: Create a new task in a specific list
 */
app.post('/lists/:listId/tasks', authenticate, (req,res) => {
   // Here we create a new task in a list specified by listId
   List.findOne({
      _id: req.params.listId,
      _userId: req.user_id
   }).then((list) => {
      if(list) {
         // list object is valid and user can create a new task
         return true;
      }

      // the user object is undefined
      return false;
   }).then((canCreateTask) => {
      if(canCreateTask){
         let newTask = new Task({
            title: req.body.title,
            _listId: req.params.listId
         });
         newTask.save().then((newTaskDoc) => {
            res.send(newTaskDoc);
         })
      } else {
         res.sendStatus(404)
      }
   });
});

/**
 * PATCH /lists/:listId/tasks/:taskId
 * Purpose: Update an existing task
 */
app.patch('/lists/:listId/tasks/:taskId', authenticate, (req,res) => {
   // Here we update an existing task specified by taskId

   List.findOne({
      _id: req.params.listId,
      _userId: req.user_id
   }).then((list) => {
      if(list) {
         // list object is valid, user is authenticated and can update a specified task
         return true;
      }

      // the user object is undefined
      return false;
   }).then((canUpdateTasks) => {
      if(canUpdateTasks) {
         // currently authenticated user can update tasks
         Task.findOneAndUpdate({
            _id: req.params.taskId,
            _listId: req.params.listId
         }, {
            $set: req.body
         }).then(() => {
            res.send({message: 'Updated successfully!'});
         });
      } else {
         res.sendStatus(404);
      }
   });


});

/**
 * DELETE /lists/:listId/tasks/:taskId
 * Purpose: Delete a task
 */
app.delete('/lists/:listId/tasks/:taskId', authenticate, (req,res) => {

   List.findOne({
      _id: req.params.listId,
      _userId: req.user_id
   }).then((list) => {
      if(list) {
         // list object is valid, user is authenticated and can update a specified task
         return true;
      }

      // the user object is undefined
      return false;
   }).then((canDeleteTasks) => {
      if(canDeleteTasks) {
         Task.findOneAndRemove({
            _id: req.params.taskId,
            _listId: req.params.listId
         }).then((removedTaskDoc) => {
            res.send(removedTaskDoc);
         });
      } else {
         res.sendStatus(404);
      }
   });

});
/* END LIST ROUTES */

//endregion

/** USER ROUTES **/

/**
 * POST /users
 * Purpose: Sign up
 */
app.post('/users', (req, res) => {
   let body = req.body;
   let newUser = new User(body);

   newUser.save().then(() => {
      return newUser.createSession();
   }).then((refreshToken) => {
      // Session created successfully - refreshToken returned.
      // now we generate an access auth token for the user
      return newUser.generateAccessAuthToken().then((accessToken) => {
         // access auth token generated successfully, now we return an object containing the auth tokens
         return {accessToken, refreshToken};
      })
   }).then((authTokens) => {
      // now we construct and send the response to the user with their auth tokens in the header and the user object in the body
      res
          .header('x-refresh-token', authTokens.refreshToken)
          .header('x-access-token', authTokens.accessToken)
          .send(newUser);
   }).catch((e) => {
      res.status(400).send(e);
   });
});

/**
 * POST /users/login
 * Purpose: login
 */
app.post('/users/login', (req, res) => {
   let email = req.body.email;
   let password = req.body.password;

   User.findByCredentials(email, password).then((user) => {
      return user.createSession().then((refreshToken) => {
         // Session created successfully - refreshToken returned
         // now we generate an access auth token for the user

         return user.generateAccessAuthToken().then((accessToken) => {
            // access auth token generated successfully, now we return an object containing the auth tokens
            return {accessToken, refreshToken};
         })
      }).then((authTokens) => {
         res
             .header('x-refresh-token', authTokens.refreshToken)
             .header('x-access-token', authTokens.accessToken)
             .send(user);
      });
   }).catch((e) => {
      res.status(400).send(e);
   });
});

/**
 * GET /users/me/access-token
 * Purpose: generates and returns an access token
 */
app.get('/users/me/access-token', verifySession, (req, res) => {
   req.userObject.generateAccessAuthToken().then((accessToken) => {
      res.header('x-access-token', accessToken).send({accessToken});
   }).catch((e) => {
      res.status(400).send(e);
   });
});

/** HELPER METHODS **/
let deleteTasksFromList = (_listId) => {
   Task.deleteMany({
      _listId
   }).then(() => {
      console.log("Tasks from " + _listId + " were deleted.")
   });
};

app.listen(3000, () => {
   console.log("server is listening on port 3000");
});

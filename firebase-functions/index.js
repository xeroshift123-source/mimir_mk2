const functions=require('firebase-functions/v1');
const admin=require('firebase-admin');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {createHandler}=require('./comparisons');
admin.initializeApp();
exports.getMimirScoreComparisons=functions.runWith({timeoutSeconds:60,memory:'512MB'}).https.onRequest(createHandler({db:getFirestore('mimirdb'),verifyIdToken:token=>getAuth().verifyIdToken(token)}));

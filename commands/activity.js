var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var http = require('http');
var watch = require('watch');
var sass = require("node-sass");
var path = require('path');
var green = '\u001b[42m \u001b[0m';
var red = '\u001b[41m \u001b[0m';
var exec = require('child_process').exec;
var figlet = require('figlet');
var moment = require('moment');
var utils;

module.exports = {
	name:'activity',
	description:'Outputs a summary of activity on the repos',
	example:'bosco activity -r <repoPattern> --since 2014-09-22T23:36:26-07:00',
	cmd:cmd
}

function cmd(bosco, args, next) {

	var repoPattern = bosco.options.repo;
	var repoRegex = new RegExp(repoPattern);

	var since = bosco.options.since;

	if (!since) {
		bosco.warn('Using --since argument as last 24 hours since no option was passed.');
		since = moment().subtract(1, 'day').format();
	}

	var repos = bosco.config.get('github:repos');
	if(!repos) return bosco.error("You are repo-less :( You need to initialise bosco first, try 'bosco clone'.");

	var activityForRepos = function(cb) {

		async.mapLimit(repos, bosco.options.cpus, function(repo, repoCb) {

		  if(!repo.match(repoRegex)) return repoCb();

		  var repoPath = bosco.getRepoPath(repo);
		  repoActivity(bosco, repoPath, repo, since, repoCb);

		}, function(err) {
			cb();
		});

	}

	activityForRepos(function() {
		bosco.log("Complete");

		if (next) next();
	});

}

function repoActivity(bosco, orgPath, repo, since, next) {

  if(!bosco.exists([orgPath,".git"].join("/"))) {
  	bosco.warn("Doesn't seem to be a git repo: "+ orgPath.blue);
  	return next();
  }

  firstRepoCommit(bosco, orgPath, repo, function(err, firstCommit){
  	if (err) return next(err);

  	exec('git log --pretty=format:"%H - %an, %ar : %s" --no-merges --since=' + since, {
	  	cwd: orgPath
		}, function(err, stdout, stderr) {
			if(err) {
				bosco.error(orgPath.blue + " >> " + stderr);
			} else {
				if (!stdout.length) return next();

				figlet(repo, function(err, data) {
					if (!err) bosco.log(data);
					else bosco.log(repo);

					bosco.log('\n' + stdout);
					if (_.contains(stdout, '\n' + firstCommit)) bosco.log('Repo was created'.green);
				});
			}

			next(err);
		});
  });
}

function firstRepoCommit(bosco, orgPath, repo, next) {
	exec('git rev-list --max-parents=0 HEAD', {
	  cwd: orgPath
	}, function(err, stdout, stderr) {
		if(err) {
			bosco.error(orgPath.blue + " >> " + stderr);
			return next(err);
		}

		return next(null, stdout.replace(/(\r\n|\n|\r)/gm,""));
	});
}

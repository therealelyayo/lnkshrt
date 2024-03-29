const http = require("http");
const fs = require("fs");
const url = require("url");

if (!fs.existsSync(__dirname + "/config.json")) {
    if (process.env.H_CAPTCHA) {var c = true; var ck = process.env.H_CAPTCHA;} else {var c = false;}
    if (c == false) {
        var j = JSON.stringify({
            allowPasswords: true,
            allowCaptcha: false,
            idLength: 5
        })
    } else {
        var j = JSON.stringify({
            allowPasswords: true,
            allowCaptcha: true,
            hCaptchaKey: ck,
            idLength: 5
        })
    }
    fs.writeFileSync(__dirname + "/config.json", j)
}

const cheerio = require("cheerio");
const {verify} = require("hcaptcha");
const bcrypt = require("bcrypt");
const config = JSON.parse(fs.readFileSync(__dirname + "/config.json"))
const port = process.env.PORT || 3333;
console.log("running @ port " + port);

http.createServer(runServer).listen(port);

function runServer(req, res) {
    var requestUrl = url.parse(req.url, true);
    var path = requestUrl.pathname;
    var pp = path.split("/").slice(1);
    if (pp[0] == "") {
        fs.readFile("./web-content/index.html", function(err, resp) {
            res.writeHead(200, {
                "Allow-Access-Content-Control": "*",
                "Content-Type": "text/html"
            })
            res.end(resp)
        })
    } else if (pp[0] == "api") {
        if (pp[1]) {
            if (pp[1] == "createUrl") {
                if (!fs.existsSync("./shorts/")) {fs.mkdirSync("./shorts/")}
                if (req.method == "POST") {
                    var body = "";
                    req.on('data', function (data) {
                        body += data;
                    });
                    req.on('end', function() {
                        var json = JSON.parse(body);
                        if (!json.url | !isURL(json.url)) {
                            var j = JSON.stringify({
                                "err": {
                                    "code": "needsMoreData",
                                    "message": "Invalid URL.",
                                    "fix": "Enter a valid url."
                                }
                            });
                            res.writeHead(400, {
                                "Allow-Access-Content-Control": "*",
                                "Content-Type": "application/json"
                            });
                            res.end(j);
                        } else {
                            var id = createId();
                            if (json.securityLevel == "1" | !json.securityLevel) {
                                var json = JSON.stringify({
                                    "id": id,
                                    "url": json.url,
                                    "securityLevel": json.securityLevel
                                })
                            } else if (json.securityLevel == "2" && config.allowPasswords) {
                                if (json.password == "") {
                                    var j = JSON.stringify({
                                        "err": {
                                            "code": "needsMoreData",
                                            "fix": "Enter a valid password.",
                                            "message": "Invalid password. Please enter a different password."
                                        }
                                    });
                                    res.writeHead(400, {
                                        "Allow-Access-Content-Control": "*",
                                        "Content-Type": "application/json"
                                    })
                                    res.end(j);
                                    return;
                                }
                                var json = JSON.stringify({
                                    "id": id,
                                    "url": json.url,
                                    "securityLevel": json.securityLevel,
                                    "password": bcrypt.hashSync(json.password, 10)
                                });
                            } else if (json.securityLevel == "3" && config.allowCaptcha == true && config.hCaptchaKey) {
                                var json = JSON.stringify({
                                    "id": id,
                                    "url": json.url,
                                    "securityLevel": json.securityLevel
                                });
                            } else {
                                var j = JSON.stringify({
                                    "err": {
                                        "code": "invalidData",
                                        "fix": "Choose a different security method",
                                        "message": "The method you chose is not allowed on this LnkShrt instance."
                                    }
                                });
                                res.writeHead(400, {
                                    "Allow-Access-Content-Control": "*",
                                    "Content-Type": "application/json"
                                })
                                res.end(j);
                            }
                            fs.writeFileSync("./shorts/" + id + ".json", json);
                            res.writeHead(200, {
                                "Allow-Access-Content-Control": "*",
                                "Content-Type": "application/json"
                            });
                            res.end(json);
                        }
                    })
                } else {
                    var j = JSON.stringify({
                        "err": {
                            "code": "methodNotAllowed",
                            "fix": "You must use the POST method",
                            "message": "Your method is not allowed."
                        }
                    });
                    res.writeHead(400, {
                        "Allow-Access-Content-Control": "*",
                        "Content-Type": "application/json"
                    });
                    res.end(j);
                }
            } else if (pp[1] == "attempt" && pp[2]) {
                if (req.method == "POST") {
                    var body = "";
                    req.on('data', function (data) {
                        body += data;
                    });
                    req.on('end', function() {
                        var json = JSON.parse(body);
                        if (!json.password) {
                            var j = JSON.stringify({
                                "err": {
                                    "code": "needsMoreData",
                                    "fix": "Enter a password.",
                                    "message": "There is no password."
                                }
                            });
                            res.writeHead(400, {
                                "Allow-Access-Content-Control": "*",
                                "Content-Type": "application/json"
                            });
                            res.end(j);
                        } else {
                            if (fs.existsSync(__dirname + "/shorts/" + pp[2] + ".json")) {
                                var jsonD = JSON.parse(fs.readFileSync(__dirname + "/shorts/" + pp[2] + ".json"));
                                if (bcrypt.compareSync(json.password, jsonD.password)) {
                                    var j = JSON.stringify({
                                        "url": jsonD.url
                                    })
                                    res.writeHead(200, {
                                        "Allow-Access-Content-Control": "*",
                                        "Content-Type": "application/json"
                                    });
                                    res.end(j);
                                } else {
                                    var j = JSON.stringify({
                                        "err": {
                                            "code": "invalidPassword",
                                            "fix": "Enter the valid password.",
                                            "message": "Incorrect password."
                                        }
                                    })
                                    res.writeHead(400, {
                                        "Allow-Access-Content-Control": "*",
                                        "Content-Type": "application/json"
                                    });
                                    res.end(j);
                                }
                            } else {
                                var j = JSON.stringify({
                                    "err": {
                                        "code": "invalidId",
                                        "fix": "Try again later.",
                                        "message": "This ID does not exist."
                                    }
                                })
                                res.writeHead(400, {
                                    "Allow-Access-Content-Control": "*",
                                    "Content-Type": "application/json"
                                });
                                res.end(j);
                            }
                        }
                    })
                } else {
                    var j = JSON.stringify({
                        "err": {
                            "code": "methodNotAllowed",
                            "fix": "You must use the POST method",
                            "message": "Your method is not allowed."
                        }
                    });
                    res.writeHead(400, {
                        "Allow-Access-Content-Control": "*",
                        "Content-Type": "application/json"
                    });
                    res.end(j);
                }
            } else if (pp[1] == "verifyCaptcha") {
                if (req.method == "POST") {
                    var body = "";
                    req.on('data', function (data) {
                        body += data;
                    });
                    req.on('end', function() {
                        body = JSON.parse(body);
                        verify(config.hCaptchaKey, body.key).then(function () {
                            var url = JSON.parse(fs.readFileSync(__dirname + "/shorts/" + body.id + ".json")).url;
                            var j = JSON.stringify({
                                "success": true,
                                "url": url
                            });
                            res.writeHead(200, {
                                "Allow-Access-Content-Control": "*",
                                "Content-Type": "application/json"
                            });
                            res.end(j)
                        }).catch(function(err) {
                            var j = JSON.stringify({
                                "success": false,
                                "err": {
                                    "message": err.message,
                                    "code": err.code
                                }
                            });
                            res.writeHead(400, {
                                "Allow-Access-Content-Control": "*",
                                "Content-Type": "application/json"
                            });
                            res.end(j);
                        })
                    });
                } else {
                    var j = JSON.stringify({
                        "err": {
                            "code": "methodNotAllowed",
                            "fix": "You must use the POST method",
                            "message": "Your method is not allowed."
                        }
                    });
                    res.writeHead(400, {
                        "Allow-Access-Content-Control": "*",
                        "Content-Type": "application/json"
                    });
                    res.end(j);
                }
            } else {
                var j = JSON.stringify({
                    "err": {
                        "code": "incorrectEndpoing",
                        "fix": "Read the docs and try again",
                        "message": "You entered an incorrect endpoint."
                    }
                });
                res.writeHead(400, {
                    "Allow-Access-Content-Control": "*",
                    "Content-Type": "application/json"
                });
                res.end(j);
            }
        }
    } else if (pp[0].length == config.idLength && pp[0] !== "css") {
        if (fs.existsSync("./shorts/") && fs.existsSync("./shorts/" + pp[0] + ".json")) {
            fs.readFile("./shorts/" + pp[0] + ".json", function(err, resp) {
                var d = JSON.parse(resp);
                if (d.securityLevel == "1" | !d.securityLevel) {
                    res.writeHead(302, {
                        "Location": d.url
                    })
                    res.end();
                } else if (d.securityLevel == "2") {
                    fs.readFile("./special/unlock.html", function(err, resp) {
                        if (!err) {
                            res.writeHead(200, {
                                "Content-Type": "text/html"
                            })
                            res.end(resp);
                        }
                    })
                } else if (d.securityLevel == "3") {
                    fs.readFile(__dirname + "/special/captcha.html", function(err, resp) {
                        if (!err) {
                            var $ = cheerio.load(resp);
                            $(".h-captcha").attr("data-sitekey", config.hCaptchaKey);
                            res.writeHead(200, {
                                "Content-Type": "text/html"
                            })
                            res.end($.html());
                        }
                    })
                }
            })
        } else {
            res.writeHead(302, {
                "Location": "/"
            })
            res.end();
        }
    } else {
        if (fs.existsSync("./web-content" + path)) {
            var fileType = path.split(".")[path.split(".").length - 1];
            fs.readFile("./web-content" + path, function (err, resp) {
                if (!err) {
                    if (fileType == "html") {
                        res.writeHead(200, {
                            "Allow-Access-Content-Control": "*",
                            "Content-Type": "text/html"
                        });
                    } else if (fileType == "js") {
                        res.writeHead(200, {
                            "Allow-Access-Content-Control": "*",
                            "Content-Type": "application/javascript"
                        });
                    } else if (fileType == "css") {
                        res.writeHead(200, {
                            "Allow-Access-Content-Control": "*",
                            "Content-Type": "text/css"
                        });
                    }
                    res.end(resp)
                } else {
                    res.end(err.code);
                }
            })
        } else if (fs.existsSync("./shorts" + path + ".json")) {
            fs.readFile("./shorts/" + path + ".json", function(err, resp) {
                var d = JSON.parse(resp);
                if (d.securityLevel == "1" | !d.securityLevel) {
                    res.writeHead(302, {
                        "Location": d.url
                    })
                    res.end();
                } else if (d.securityLevel == "2") {
                    fs.readFile("./special/unlock.html", function(err, resp) {
                        res.writeHead(200, {
                            "Content-Type": "text/html"
                        })
                        res.end(resp);
                    })
                }
            })
        } else {
            fs.readFile("./error-pages/404.html", function (err, resp) {
                res.writeHead(404, {
                    "Content-Type": "text/html"
                })
                res.end(resp);
            })
        }
    }
}

function isURL(str) {
    var urlRegex = '^(?!mailto:)(?:(?:http|https|ftp)://)(?:\\S+(?::\\S*)?@)?(?:(?:(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[0-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))|localhost)(?::\\d{2,5})?(?:(/|\\?|#)[^\\s]*)?$';
    var url = new RegExp(urlRegex, 'i');
    return str.length < 2083 && url.test(str);
}

function createId() {
    var result = "";
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    for (var c = 0; c < config.idLength; c++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

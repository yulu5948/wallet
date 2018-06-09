'use strict';

var hasWallet = true;

var dappAddr = "n1pQzpoom8cRGix3FZkEsZ6cL3PRMLBEeve";
var Nebulas = require("nebulas");
var neb = new Nebulas.Neb();
var Account = Nebulas.Account;

neb.setRequest(new Nebulas.HttpRequest("https://testnet.nebulas.io"));

var NebPay = require("nebpay");
var nebPay = new NebPay();

var serialNumber;
var intervalQuery;
var userCaddr = "";
var defaultUser = 'n1UkzP977VGbsPth7rQqaMDnVCGUtRUzCPY';
var fee = 0;
var curUser = "";

function getWalletInfo() {
    window.postMessage({
        "target": "contentscript",
        "data": {},
        "method": "getAccount",
    }, "*");

    window.addEventListener('message', function (ev) {
        if(ev.data && ev.data.data) {
            if(ev.data.data.account) {
                curUser = ev.data.data.account;
                showCurUser();
            }
        }
    })
}

function showCurUser() {
    $("#userAddr").text(curUser);
    $("#walleturl").attr('href', "./wallet.html?addr=" + curUser);
}

function convertWeiToNas(wei) {
    var unit = Nebulas.Unit;
    return unit.fromBasic(wei, "nas");
}

function convertNasToWei(nas) {
    var unit = Nebulas.Unit;
    var utils = Nebulas.Utils;
    return unit.nasToBasic(utils.toBigNumber(nas));
}

function doGET(from, func, args, callback) {
    var value = "0";
    var nonce = "0";
    var gas_price = "1000000";
    var gas_limit = "2000000";
    var callFunc = func;
    var callArgs = JSON.stringify(args);
    var contract = {
        "function": callFunc,
        "args": callArgs
    };

    neb.api.call(from, dappAddr, value, nonce, gas_price, gas_limit, contract).then(function (resp) {
        callback(resp);
    }).catch(function (err) {
        console.log("读取 " + callFunc + " 失败 " + err.message);
    })
}

function doPost(value, func, args, callbackFunc) {
    var to = dappAddr;
    var val = value;
    var callFunc = func;
    var callArgs = JSON.stringify(args);

    serialNumber = nebPay.call(to, val, callFunc, callArgs, {
        listener: callbackFunc
    });

    console.log("serialNumber is: ", serialNumber);
}


function checkWallet() {
    if (typeof(webExtensionWallet) === 'undefined') {
        var tips = '<div class="row alert alert-danger">\n' +
            '    <a href="https://github.com/ChengOrangeJu/WebExtensionWallet" target="_blank"> <strong>注意!</strong>未检测到浏览器扩展，请点我下载安装\n</a>' +
            '    <a href="#" class="close" data-dismiss="alert">&times;</a>\n' +
            '</div>';
        $("#tips").html(tips);
        hasWallet = false;
    }
}

function cancelBlock() {
    $.unblockUI();
}

// 间歇性查询
function doIntervalQuery(txhash, succCB, failCB) {
    neb.api.getTransactionReceipt(txhash).then(function (resp) {
        if(resp.status == 0) {
            // fail
            console.log("fail ", resp);
            clearInterval(intervalQuery);
            failCB(resp);
        } else if(resp.status == 1) {
            // succ
            console.log("success: ", resp);
            clearInterval(intervalQuery);
            succCB(resp);
        } else {
            console.log("交易查询中...");
        }
    });
}

// post 查询成功的 callback
function succCB(resp) {
    cancelBlock();
    window.location.href="./wallet.html?addr=" + curUser;
}

// post 查询失败的 callback
function failCB(resp) {
    cancelBlock();

}

$(document).ready(function () {
    // 查询用户名是否可注册
    function queryNameUse(name) {
        var func = "checkNameUse";
        var args = [name];
        doGET(defaultUser, args, queryNameUseCB);
    }

    function queryNameUseCB(resp) {
        console.log("名字查询结果 ", resp);
    }

    $("#doAdd").on("click", function (event) {
        event.preventDefault();

        var ctype = $("#ctype").val();
        var addr = $("#caddr").val();
        var tag = $("#ctag").val();
        var info = $("#cinfo").val();

        if(addr.length <= 0) {
            alert("货币地址不能为空");
            return;
        }

        addAddr(ctype, addr, tag, info);
    });

    // 提交新币种地址
    function addAddr(ctype, addr, tag, info) {
        if(hasWallet == false) {
            alert("未检测到钱包插件，请先根据使用说明安装钱包插件");
            return
        }

        $('body').block({
            message: "正在处理，请稍后...",
            css: {
                border: "3px solid #ddd"
            }
        });

        var func = "addCoinAddr";
        var args = [ctype, addr,tag, info];
        var value = "0";

        doPost(value, func, args, addAddrCB);
    }


    function addAddrCB(resp) {
        console.log("addAddrCB: ", resp);
        if(typeof resp == "string") {
            if(resp.indexOf("Error") != -1) {
                if(resp.indexOf("reject") != -1) {
                    cancelBlock();
                    alert("需要提交交易才能处理数据");
                } else {
                    cancelBlock();
                    alert("交易发生错误 " + resp);
                }
            } else {
                cancelBlock();
                alert("发生未知错误，请刷新页面重试");
            }
        } else {
            var txhash = resp.txhash;
            console.log("addAddrCB txhash ", txhash);

            intervalQuery = setInterval(function () {
                doIntervalQuery(txhash, succCB, failCB);
            }, 5000);
        }
    }

    // 读取用户提交的所有的币种
    function getUserCoin(from) {
        console.log('from', from);
        var func = "getUserByAddr";
        var args = [from];

        doGET(defaultUser, func, args, getUserCoinCB);
    }

    function getUserCoinCB(resp) {
        console.log('coin callback', resp);
        var data = resp.result;
        data = JSON.parse(data);
        if(data == null) {
            var warnInfo = '<div class="alert alert-danger" role="alert"><a href="./index.html">还没有任何信息，现在就来添加吧！</a></div>';
            $("#walletInfo").html(warnInfo);

            return;
        }

        var owner = data.owner;

        $("#walletOwner").text(owner);

        var wallets = data.wallets;
        var html = "";
        for(var i=0; i<wallets.length; i++) {
            var wl = wallets[i];
            if(wl.owner != curUser) {
                if(wl.show == 0) {
                    continue; // 不展示对外人
                }
            }

            var ltr = "<tr>";
            var rtr = "</tr>";
            var td = "<td>" + wl.ctype + "</td>" + "<td>" + wl.address + "</td>" + "<td>" + wl.tag + "</td>" + "<td>" + wl.info + "</td>";

            html += ltr + td + rtr;
        }

        console.log(html);

        $("#datalist").html(html);
    }

    function getCurUserAddr() {
        if(curUser != "") {
            $("#userAddr").text(curUser);
            return;
        }

        if(hasWallet == false) {
            curUser = "请先安装钱包插件";
        }

        doGET(defaultUser, "getCurUser", [], showCurUser)
    }


    checkWallet();
    if(hasWallet == true) {
        //getCurUserAddr();
        getWalletInfo();
        showCurUser();
    }

    var curUri = window.location.href;
    if(curUri.indexOf('wallet') != -1) {
        var sp = new URLSearchParams(window.location.search);
        var addr = sp.get('addr');
        getWalletInfo();
        getUserCoin(addr);
    }
});


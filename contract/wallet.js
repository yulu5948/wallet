"use strict";

// 漂亮的、收集个人所有的数字货币地址的服务
// 每个注册用户都有自己唯一的一个页面，展示自己所有的地址


var UserItem = function (data) {
    if(data) {
        data = JSON.parse(data);
        this.owner = data.owner; // 星云钱包地址
        this.showName = data.showName; // 别名，网页展示用
        this.info = data.info; // 可以添加的一些信息，会展示在个人的地址页面
    } else {
        this.owner = "";
        this.showName= "";
        this.info = "";
    }
};

UserItem.prototype = {
    toString: function () {
        return JSON.stringify(this);
    }
};

var WalletItem = function (data) {
    if(data) {
        data = JSON.parse(data);
        this.id = data.id;
        this.owner = data.owner;
        this.ctype = data.ctype; // 货币类型/类型 BTC/ETC
        this.address = data.address; // 收付款地址
        this.tag = data.tag; // 地址取的别名
        this.info = data.info; // 这个地址包含的额外信息
        this.show = data.show; // 0-不展示， 1-展示，指的是对别人
        this.ct = data.ct;
    } else {
        this.id = "";
        this.owner = "";
        this.ctype = "";
        this.address = "";
        this.tag = "";
        this.info = "";
        this.show = 1;
        this.ct = 0;
    }
};

WalletItem.prototype = {
    toString: function () {
        return JSON.stringify(this);
    }
};

var WalletAPI = function () {
    LocalContractStorage.defineMapProperty(this, "config", {
        parse: function (data) {
            return JSON.parse(data);
        },
        stringify: function (o) {
            return JSON.stringify(o);
        }
    });

    LocalContractStorage.defineMapProperty(this, "userItem", {
        parse: function (data) {
            return new UserItem(data);
        },
        stringify: function (o) {
            return JSON.stringify(o);
        }
    });

    // 记录一个唯一的名字是否被占用了
    LocalContractStorage.defineMapProperty(this, "nameMap", {
        parse: function (data) {
            return JSON.parse(data);
        },
        stringify: function (o) {
            return JSON.stringify(o);
        }
    });

    // 名字列表
    LocalContractStorage.defineMapProperty(this, "names", {
        parse: function (data) {
            return JSON.parse(data);
        },
        stringify: function (o) {
            return JSON.stringify(o);
        }
    });

    LocalContractStorage.defineMapProperty(this, "walletItem", {
        parse: function (data) {
            return new WalletItem(data);
        },
        stringify: function (o) {
            return JSON.stringify(o);
        }
    });

    LocalContractStorage.defineMapProperty(this, "userWallet", {
        parse: function (data) {
            return JSON.parse(data);
        },
        stringify: function (o) {
            return JSON.stringify(o);
        }
    });
};

WalletAPI.prototype = {
    init: function () {
        var admin = "n1UkzP977VGbsPth7rQqaMDnVCGUtRUzCPY";
        this.config.set('admin', admin);
    },

    getCurUser: function () {
        return Blockchain.transaction.from;
    },

    // 用户注册
    register: function (name, info) {
        var from = Blockchain.transaction.from;
        var user = this.userItem.get(from);
        if(user != null) {
            if(user.showName != from) { // 非初始化的数据
                throw new Error("用户已注册");
            }
        }

        name = strings.trim(name);
        var nm = this.nameMap.get(name);
        if(nm != null) {
            throw new Error("名字已存在，请换一个");
        }

        user = new UserItem();
        user.owner = from;
        user.showName = name;
        user.info = info;
        this.userItem.set(from, user);
        this.nameMap.set(name, from);

        var names = this.names.get('NAMES') || [];
        names.push(name);
        this.names.set('NAMES', names);

        return true;
    },

    // 检查名字是否已被占用
    // 0-未占用 1-已占用
    checkNameUse: function (name) {
        if(name == null) {
            throw new Error("输入不能为空");
        }

        name = strings.trim(name);
        var from = this.nameMap.get(name);
        if(from != null) {
            return 0;
        }
        return 1;
    },

    // 根据 address 读取用户信息
    // 如果查看账户的用户不是自己，那么就不展示隐藏的信息
    getUserByAddr: function (from) {
        var curUser = Blockchain.transaction.from;
        if(from == null) {
            from = Blockchain.transaction.from;
        }

        var user = this.userItem.get(from);
        if(user == null) {
            return null;
        }

        // 读取其所有钱包地址
        var userWallet = this.userWallet.get(from) || [];
        var wallets = [];
        for(var i=0; i<userWallet.length; i++) {
            var witem = this.walletItem.get(userWallet[i]);
            if(curUser != witem.owner) {
                if(witem.show == 1) {
                    wallets.push(witem);
                }
            } else {
                wallets.push(witem);
            }
        }

        user.wallets = wallets;

        return user;
    },

    // 根据 name 读取用户信息
    getUserByName: function (name) {
        var from = this.nameMap.get(name);
        if(from == null) {
            return null;
        }

        var info = this.getUserByAddr(from);
        return info;
    },
    
    // 提交货币地址
    addCoinAddr: function (ctype, addr, tag, info) {
        var from = Blockchain.transaction.from;
        var user = this.userItem.get(from);
        if(user == null) {
            user = new UserItem();
            user.owner = from;
            user.showName = from;
            user.info = "";
            this.userItem.set(from, user);
        }

        var wallet = new WalletItem();
        var wid = Blockchain.transaction.hash;
        wallet.id = wid;
        wallet.owner = from;
        wallet.ctype = ctype;
        wallet.address = addr;
        wallet.tag = tag;
        wallet.info = info;
        wallet.show = 1;
        wallet.ct = Date.now();

        this.walletItem.set(wid, wallet);

        var userWallet = this.userWallet.get(from) || [];
        userWallet.push(wid);
        this.userWallet.set(from, userWallet);

        return true;
    },

    // 修改货币地址的 address 或 tag 或 info
    updateCoinAddr: function (wid, ctype, addr, tag, info, show) {
        var from = Blockchain.transaction.from;
        var wallet = this.walletItem.get(wid);
        if(wallet == null) {
            throw new Error("无指定 id 的货币地址");
        }

        if(wallet.owner != from) {
            throw new Error("不允许操作非本人数据");
        }

        wallet.ctype = ctype;
        wallet.address = addr;
        wallet.tag = tag;
        wallet.info = info;
        wallet.show = show;

        this.walletItem.set(wid, wallet);

        return true;
    },

    getAdmin: function () {
        return this.config.get('admin');
    }
};

module.exports = WalletAPI;
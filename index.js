const express = require("express");
const mysql = require('mysql');
const bodyParser = require("body-parser");
const app = express();
const multer = require("multer");
const path = require("path");
const Tesseract = require('tesseract.js');
const axios = require('axios')

var connection = mysql.createConnection({
    host: '34.101.223.29',
    user: 'root',
    password: '',
    database: 'moccadb'
});

connection.connect(function (err) {
    if (err) throw err
    console.log('You are now connected with mysql database...')
})

app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));

var server = app.listen(3000, "127.0.0.1", function () {

    var host = server.address().address
    var port = server.address().port
  
    console.log("Example app listening at http://%s:%s", host, port)
  
  });

  const performOCR = async (src) => {
    const ocr = await Tesseract.recognize(src, 'eng')
    return ocr.data.text
}

const storage = multer.diskStorage({
    destination: './upload/images',
    filename: (req, file, cb) => {
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
})

app.use('/scan', express.static('upload/images'));
app.post("/upload", upload.single('scan'), async (req, res) => {
    try{
    let ocr = await performOCR(`upload/images/${req.file.filename}`)
    let product = []
    let product_name = []
    let data = ocr.split('\n')
    data = data.filter(item => item != '' && item.length > 3)

    for(let index=0; index<data.length;index++){
        let item = data[index]
        let price = (item.match(/\d+(.\d{1,3})+(,\d{1,2})/) || item.match(/\d+(,\d{1,3})+(.\d{1,2})/))
        if(price){
            let name_product = data[index-1].split(" ").filter(e=> e.length>1 && e.match(/^[A-Za-z]+$/)).join(" ")
            if(name_product){
                let category = await axios.get(`https://harmoni.pythonanywhere.com/klasifikasi?name_product=${name_product}`)
                product.push({"name_product" : name_product, "price": price[0], "category": category.data.category})
                product_name.push(name_product)
            }
        }
    }

    res.json({
        success: 1,
        product:product
    })
    }catch(err){
        res.json({
            success: 0,
            error:err
        })
    }
})

app.get("/dashboard/income/:idUser", function (req, res) {
    const idUser = req.params.idUser
    const query = "SELECT SUM(PRICE) FROM INCOME WHERE MONTH(created_at) = MONTH(CURRENT_TIMESTAMP) && idUser = ?"
    connection.query(query,[idUser], function(err,rows) {
        if(err) {
            res.status(500).send({message: err.sqlMessage})
        } else {
            res.json(rows)
        }
    })
})

app.get("/dashboard/outcome/:idUser", function (req, res) {
    const idUser = req.params.idUser
    const query = "SELECT SUM(PRICE) FROM OUTCOME WHERE MONTH(created_at) = MONTH(CURRENT_TIMESTAMP) && idUser = ?"
    connection.query(query,[idUser], function(err,rows) {
        if(err) {
            res.status(500).send({message: err.sqlMessage})
        } else {
            res.json(rows)
        }
    })
})

app.get("/getlast10transaction/:idUser", function (req, res) {
    const idUser = req.params.idUser
    const query = "SELECT * FROM INCOME UNION SELECT * FROM OUTCOME HAVING idUser = ? ORDER BY created_at DESC LIMIT 10"
    connection.query(query,[idUser], function(err,rows) {
        if(err) {
            res.status(500).send({message: err.sqlMessage})
        } else {
            res.json(rows)
        }
    })
})

app.get("/gettrasaction/:idUser", function (req, res) {
    const idUser = req.params.idUser
    const query = "SELECT * FROM INCOME UNION SELECT * FROM OUTCOME HAVING idUser = ?"
    connection.query(query,[idUser], function(err,rows) {
        if(err) {
            res.status(500).send({message: err.sqlMessage})
        } else {
            res.json(rows)
        }
    })
})

app.post("/insertincome/:idUser",(req, res) => {
    const idUser = req.params.idUser
    const name_product = req.body.name_product
    const categoryid = req.body.categoryid
    const price = req.body.price

    const query = "INSERT INTO INCOME (idUser, name_product, categoryid, price) values (?, ?, ?, ?)"

    connection.query(query, [idUser, name_product, categoryid, price], (err, rows, fields) => {
        if (err) {
            res.status(500).send({message: err.sqlMessage})
        } else {
            res.send({message: "Insert Successful"})
        }
    })
})

app.post("/insertoutcome/:idUser",(req, res) => {
    const idUser = req.params.idUser
    const name_product = req.body.name_product
    const categoryid = req.body.categoryid
    const price = req.body.price

    const query = "INSERT INTO OUTCOME (idUser, name_product, categoryid, price) values (?, ?, ?, ?)"

    connection.query(query, [idUser, name_product, categoryid, price], (err, rows, fields) => {
        if (err) {
            res.status(500).send({message: err.sqlMessage})
        } else {
            res.send({message: "Insert Successful"})
        }
    })
})

app.delete("/deleteincome/:idIncome", (req, res) => {
    const idIncome = req.params.idIncome
    
    const query = "DELETE FROM INCOME WHERE idIncome = ?"
    connection.query(query, [idIncome], (err, rows, fields) => {
        if (err) {
            res.status(500).send({message: err.sqlMessage})
        } else {
            res.send({message: "Delete successful"})
        }
    })
})

app.delete("/deleteoutcome/:idOutcome", (req, res) => {
    const idOutcome = req.params.idOutcome
    
    const query = "DELETE FROM OUTCOME WHERE idOutcome = ?"
    connection.query(query, [idOutcome], (err, rows, fields) => {
        if (err) {
            res.status(500).send({message: err.sqlMessage})
        } else {
            res.send({message: "Delete successful"})
        }
    })
})

app.get("/getcategory/:idUser", function (req, res) {
    const idUser = req.params.idUser
    const query = "SELECT CATEGORY.name_category, CATEGORY.budget-SUM(OUTCOME.price) AS sisabudget FROM CATEGORY, OUTCOME WHERE CATEGORY.idUser = ? GROUP BY CATEGORY.categoryId;"
    connection.query(query,[idUser], function(err,rows) {
        if(err) {
            res.status(500).send({message: err.sqlMessage})
        } else {
            res.json(rows)
        }
    })
})

app.post("/insertcategory/:idUser",(req, res) => {
    const idUser = req.params.idUser
    const name_category = req.body.name_category
    const budget = req.body.budget

    const query = "INSERT INTO CATEGORY (idUser, name_category, budget) values (?, ?, ?)"

    connection.query(query, [idUser, name_category, budget], (err, rows, fields) => {
        if (err) {
            res.status(500).send({message: err.sqlMessage})
        } else {
            res.send({message: "Insert Successful"})
        }
    })
})
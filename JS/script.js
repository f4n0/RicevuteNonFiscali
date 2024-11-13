var $table = $('#receiptsTbl')
var $form = $('#receiptsForm')
var index = 0;
var signaturePad, canvas;
$(function () {
    $table.bootstrapTable();

    canvas = document.querySelector("canvas");
    signaturePad = new SignaturePad(canvas);

    let OldSignature = localStorage.getItem("Signature");
    if (OldSignature) {
        signaturePad.fromDataURL(OldSignature);
    }

    let latestNo = localStorage.getItem("Nos");
    if (latestNo) {
        document.getElementsByName("LastNo")[0].value = latestNo;
    }

    $("#datepicker").datepicker({
        dateFormat: 'dd/mm/yy'
    }).datepicker("setDate", new Date());

    $form.on("submit", (event) => {
        event.preventDefault();
        var data = getFormData($form);
        var holders = data.Holder.replace('\t', '').split("\r\n");
        var tempNos = BuildNos(data.LastNo)
        var dataArr = [];
        for (var single in holders) {
            var builded = {
                "LastNo": tempNos,
                "Date": data.Date,
                "Holder": holders[single],
                "Reason": data.Reason.replace('\t', ''),
                "Price": data.Price,
                "Total": data.Total,
                "No": tempNos
            };
            dataArr.push(builded);
            tempNos = IncreaseNos(tempNos);
        }
        $table.bootstrapTable('append', dataArr);

        document.getElementsByName("LastNo")[0].value = tempNos;

        return false;
    })

    $("#printReceipts").on("click", () => {
        var ret = addSignatureToTemplate();
        if (ret) {
            var data = $table.bootstrapTable('getData');
            $("#Links").empty();
            var template = $("#template").clone().removeAttr("style").html();
            var $content = $("#all");

            for (var element in data) {
                var edited = template
                Object.keys(data[element]).forEach(val => {
                    edited = edited.replaceAll("{{" + val + "}}", data[element][val]);
                })
                $content.append(edited)
            };
            var res = document.getElementById('all').getElementsByClassName('Content');

            var zip = new JSZip();
            Array.prototype.forEach.call(res, function (elem) {
                var options = {
                    width: 1920,
                    height: 500
                }
                domtoimage.toPng(elem, options).then(function (dataUrl) {
                    zip.file(elem.getAttribute("data-id") + ".png", dataUrl.split(',')[1], { base64: true });
                    //downloadURI(dataUrl, elem.getAttribute("data-id"));
                    elem.remove();
                    if (res.length == 0) {
                        zip.generateAsync({ type: "base64" }).then(function (base64) {
                            downloadURI("data:application/zip;base64," + base64, "ricevute.zip");
                        });
                    }
                })
            });

        }

    });

    function downloadURI(uri, name) {
        var link = document.createElement("a");
        link.download = name;
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        delete link;
    }

    $("#CopyExcel").click(function () {
        let tmpText = "";
        var data = $table.bootstrapTable('getData');
        for (var element in data) {
            tmpText += (data[element]["No"] + '\t');
            tmpText += (data[element]["Date"] + '\t');
            tmpText += (data[element]["Reason"] + ' - ' + data[element]["Holder"] + '\t');
            tmpText += (data[element]["Total"] + '\t\n');
        }
        //document.execCommand("copy");
        navigator.clipboard.writeText(tmpText)
    });

    $('input[name="Total"]').on('input', function () {
        let tot = $('input[name="Total"]').val();
        $('input[name="Price"]').val(sgart.convNumLett(tot, false, false));

    });


})

function BuildNos(value) {
    if (value == "") value = "0";
    if(value.indexOf("-") != -1 ){

    }
    var intvalue = parseInt((/([0-9]){1,}(?!-)/g.exec(value))[0]);
    var paddedVal = pad(intvalue, 5);
    var newVal = value.replace(/([0-9]){1,}(?!-)/g, paddedVal);
    return newVal;
}

function IncreaseNos(value) {
    var intvalue = parseInt((/([0-9]){1,}(?!-)/g.exec(value))[0]) + 1;
    var paddedVal = pad(intvalue, 5);
    var newVal = value.replace(/([0-9]){1,}(?!-)/g, paddedVal);

    localStorage.setItem("Nos", newVal);
    return newVal;
}

function pad(str, max) {
    str = str.toString();
    return str.length < max ? pad("0" + str, max) : str;
}

function getFormData($form) {
    var unindexed_array = $form.serializeArray();
    var indexed_array = {};

    $.map(unindexed_array, function (n, i) {
        indexed_array[n['name']] = n['value'];
    });

    return indexed_array;
}

// start signature



function addSignatureToTemplate() {
    if (signaturePad.isEmpty()) {
        alert("Please provide a signature first.");
        return false;
    }

    var data = signaturePad.toDataURL('image/png');
    document.getElementById("ReceiptSignature").src = data;
    return true;
}

function ClearSignaturePad() {
    signaturePad.clear();
    localStorage.removeItem("Signature");
}

function SaveSignature() {
    if (signaturePad.isEmpty()) {
        return alert("Please provide a signature first.");
    }

    var data = signaturePad.toDataURL('image/png');
    localStorage.setItem("Signature", data);
}

function ImportSignature() {
    $("#ImportExistingSignature").val("")
    ClearSignaturePad()
    $("#ImportExistingSignature").click();
}

$("#ImportExistingSignature").on("change", function () {
    var reader = new FileReader();
    reader.onload = imageIsLoaded;
    reader.readAsDataURL($("#ImportExistingSignature")[0].files[0]);

})

function imageIsLoaded(e) {
    if (e.target.result.length > 0)
        signaturePad.fromDataURL(e.target.result, { ratio: 1 });
}
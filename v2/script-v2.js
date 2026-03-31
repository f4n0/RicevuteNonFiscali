var $table = $('#receiptsTbl');
var $form = $('#receiptsForm');
var signaturePad, canvas;

// ===== Toast Notification System =====
function showToast(message, type) {
    type = type || 'success';
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');
    toast.className = 'toast-v2 toast-' + type;

    var icons = {
        success: 'fa-check-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle',
        error: 'fa-times-circle'
    };

    toast.innerHTML = '<i class="fas ' + (icons[type] || icons.success) + '"></i> ' + message;
    container.appendChild(toast);

    // Trigger animation
    setTimeout(function () { toast.classList.add('show'); }, 20);

    // Auto-remove
    setTimeout(function () {
        toast.classList.remove('show');
        setTimeout(function () { toast.remove(); }, 350);
    }, 3000);
}

// ===== Update receipt count badge =====
function updateReceiptCount() {
    var data = $table.bootstrapTable('getData');
    var count = data.length;
    var badge = document.getElementById('receiptCount');
    badge.textContent = count;
    if (count > 0) {
        badge.classList.remove('empty');
    } else {
        badge.classList.add('empty');
    }
}

// ===== Main initialization =====
$(function () {
    $table.bootstrapTable();

    canvas = document.querySelector("canvas");
    signaturePad = new SignaturePad(canvas);

    // Load saved signature
    var oldSignature = localStorage.getItem("Signature");
    if (oldSignature) {
        signaturePad.fromDataURL(oldSignature);
    } else {
        // No signature: show notice and auto-expand panel
        document.getElementById('signatureNotice').style.display = 'flex';
        $('#signatureBody').collapse('show');
    }

    // Load saved number
    var latestNo = localStorage.getItem("Nos");
    if (latestNo) {
        document.getElementsByName("LastNo")[0].value = latestNo;
    }

    // Initialize datepicker
    $("#datepicker").datepicker({
        dateFormat: 'dd/mm/yy'
    }).datepicker("setDate", new Date());

    // ===== Form Submit =====
    $form.on("submit", function (event) {
        event.preventDefault();
        var data = getFormData($form);

        if (!data.Holder || !data.Holder.trim()) {
            showToast('Inserisci almeno un nome!', 'warning');
            return false;
        }

        var holders = data.Holder.replace('\t', '').split("\r\n").filter(function (h) {
            return h.trim() !== '';
        });

        if (holders.length === 0) {
            showToast('Inserisci almeno un nome!', 'warning');
            return false;
        }

        var tempNos = BuildNos(data.LastNo);
        var dataArr = [];

        for (var i = 0; i < holders.length; i++) {
            dataArr.push({
                "LastNo": tempNos,
                "Date": data.Date,
                "Holder": holders[i].trim(),
                "Reason": data.Reason.replace('\t', ''),
                "Price": data.Price,
                "Total": data.Total,
                "No": tempNos
            });
            tempNos = IncreaseNos(tempNos);
        }

        $table.bootstrapTable('append', dataArr);
        document.getElementsByName("LastNo")[0].value = tempNos;

        // Partial reset: clear names and amount, keep date + reason for fast entry
        $('textarea[name="Holder"]').val('');
        $('input[name="Total"]').val('');
        $('input[name="Price"]').val('');

        updateReceiptCount();
        showToast(holders.length + (holders.length === 1 ? ' ricevuta aggiunta' : ' ricevute aggiunte'), 'success');

        return false;
    });

    // ===== Print Receipts =====
    $("#printReceipts").on("click", function () {
        var data = $table.bootstrapTable('getData');
        if (data.length === 0) {
            showToast('Nessuna ricevuta da stampare!', 'warning');
            return;
        }

        var ret = addSignatureToTemplate();
        if (!ret) return;

        $("#Links").empty();
        var template = $("#template").clone().removeAttr("style").html();
        var $content = $("#all");

        for (var element in data) {
            var edited = template;
            Object.keys(data[element]).forEach(function (val) {
                edited = edited.replaceAll("{{" + val + "}}", data[element][val]);
            });
            $content.append(edited);
        }

        var res = document.getElementById('all').getElementsByClassName('Content');
        var zip = new JSZip();

        Array.prototype.forEach.call(res, function (elem) {
            var options = { width: 1920, height: 500 };
            domtoimage.toPng(elem, options).then(function (dataUrl) {
                zip.file(elem.getAttribute("data-id") + ".png", dataUrl.split(',')[1], { base64: true });
                elem.remove();
                if (res.length === 0) {
                    zip.generateAsync({ type: "base64" }).then(function (base64) {
                        downloadURI("data:application/zip;base64," + base64, "ricevute.zip");
                        showToast('Download avviato!', 'info');
                    });
                }
            });
        });
    });

    // ===== Copy to Excel (v2 format) =====
    $("#CopyExcel").click(function () {
        var data = $table.bootstrapTable('getData');
        if (data.length === 0) {
            showToast('Nessun dato da copiare!', 'warning');
            return;
        }

        var tmpText = "";
        for (var element in data) {
            // Format: Date | No | Holder | "Quota" | Reason | Amount
            tmpText += data[element]["Date"] + '\t';
            tmpText += data[element]["No"] + '\t';
            tmpText += data[element]["Holder"] + '\t';
            tmpText += 'Quota\t';
            tmpText += data[element]["Reason"] + '\t';
            tmpText += data[element]["Total"].replace('.', ',') + '\n';
        }

        navigator.clipboard.writeText(tmpText).then(function () {
            showToast('Copiato negli appunti! Incolla con Ctrl+V', 'success');
        }).catch(function () {
            showToast('Errore durante la copia', 'error');
        });
    });

    // ===== Auto-calculate price in words =====
    $('input[name="Total"]').on('input', function () {
        var tot = $(this).val();
        if (tot && parseFloat(tot) > 0) {
            $('input[name="Price"]').val(sgart.convNumLett(tot, false, false));
        } else {
            $('input[name="Price"]').val('');
        }
    });

    // Initial count
    updateReceiptCount();
});

// ===== Utility: Download URI =====
function downloadURI(uri, name) {
    var link = document.createElement("a");
    link.download = name;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    link = null;
}

// ===== Number Handling =====
function BuildNos(value) {
    if (!value || value === "") value = "0";
    var match = /([0-9]+)(?!.*-)/g.exec(value);
    if (!match) return "00001";
    var intvalue = parseInt(match[0]);
    var paddedVal = pad(intvalue, 5);
    return value.replace(/([0-9]+)(?!.*-)/g, paddedVal);
}

function IncreaseNos(value) {
    var match = /([0-9]+)(?!.*-)/g.exec(value);
    if (!match) return "00001";
    var intvalue = parseInt(match[0]) + 1;
    var paddedVal = pad(intvalue, 5);
    var newVal = value.replace(/([0-9]+)(?!.*-)/g, paddedVal);
    localStorage.setItem("Nos", newVal);
    return newVal;
}

function pad(str, max) {
    str = str.toString();
    return str.length < max ? pad("0" + str, max) : str;
}

// ===== Form Serialization =====
function getFormData($form) {
    var unindexed_array = $form.serializeArray();
    var indexed_array = {};
    $.map(unindexed_array, function (n) {
        indexed_array[n['name']] = n['value'];
    });
    return indexed_array;
}

// ===== Signature Functions =====
function addSignatureToTemplate() {
    if (signaturePad.isEmpty()) {
        showToast('Devi prima aggiungere una firma!', 'error');
        $('#signatureBody').collapse('show');
        return false;
    }
    var data = signaturePad.toDataURL('image/png');
    document.getElementById("ReceiptSignature").src = data;
    return true;
}

function ClearSignaturePad() {
    signaturePad.clear();
    localStorage.removeItem("Signature");
    document.getElementById('signatureNotice').style.display = 'flex';
    showToast('Firma cancellata', 'info');
}

function SaveSignature() {
    if (signaturePad.isEmpty()) {
        showToast('Firma prima di salvare!', 'warning');
        return;
    }
    var data = signaturePad.toDataURL('image/png');
    localStorage.setItem("Signature", data);
    document.getElementById('signatureNotice').style.display = 'none';
    showToast('Firma salvata!', 'success');
}

function ImportSignature() {
    $("#ImportExistingSignature").val("");
    ClearSignaturePad();
    $("#ImportExistingSignature").click();
}

// ===== Import Signature File =====
$("#ImportExistingSignature").on("change", function () {
    if (this.files && this.files[0]) {
        var reader = new FileReader();
        reader.onload = function (e) {
            if (e.target.result.length > 0) {
                signaturePad.fromDataURL(e.target.result, { ratio: 1 });
            }
        };
        reader.readAsDataURL(this.files[0]);
    }
});

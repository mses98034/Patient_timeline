const secondLevelCategories = {
    ER: ["LIS", "RIS", "MEDICATION", "PATHOLOGY", "SURGICAL", "OTHER"],
    OPD: ["LIS", "RIS", "MEDICATION", "PATHOLOGY", "SURGICAL", "OTHER"],
    IPD: ["LIS", "RIS", "MEDICATION", "PATHOLOGY", "SURGICAL", "OTHER"]
};

function updateSecondLevelOptions() {
    const level1Category = document.getElementById('level-1-category').value;
    const level2Category = document.getElementById('level-2-category');
    level2Category.innerHTML = '<option value="" disabled selected>選擇第二層類別</option>';
    secondLevelCategories[level1Category]?.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        level2Category.appendChild(opt);
    });
}

function addEntry() {
    const formData = new FormData(document.getElementById('entryForm'));
    formData.append('level-1-category', document.getElementById('level-1-category').value);
    formData.append('level-2-category', document.getElementById('level-2-category').value);

    fetch('/next', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            document.getElementById('entryForm').reset();
            document.getElementById('patient_number').disabled = true;
            document.getElementById('gender').disabled = true;
            document.getElementById('age').disabled = true;
            document.getElementById('nextButton').disabled = true;
            updateTimeline();
            updateDataSummary();
        } else {
            console.error("Error adding entry:", data.message);
        }
    })
    .catch(error => console.error("Fetch error:", error));
}

function updateTimeline() {
    fetch('/make')
    .then(response => response.json())
    .then(data => {
        const graphJSON = JSON.parse(data.graphJSON);
        console.log("DEBUG GRAPH JSON:", graphJSON); // 调试输出
        Plotly.newPlot('timeline', graphJSON.data, graphJSON.layout);
    })
    .catch(error => console.error("Error updating timeline:", error));
}


function updateDataSummary() {
    fetch('/show_all')
    .then(response => response.json())
    .then(data => {
        const allDataDiv = document.getElementById('allData');
        const patientInfo = data.patient_info;
        let allDataText = `<p>This is a ${patientInfo.age} year-old ${patientInfo.gender} patient.</p>`;
        
        const sortedEntries = data.data_entries.sort((a, b) => new Date(a.date) - new Date(b.date));
        sortedEntries.forEach((entry, index) => {
            const safeDescription = entry.description.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            allDataText += `
                <div class="entry">
                    <input type="checkbox" data-id="${entry.id}" onclick="toggleHighlight(this, 'entry-${index}'); toggleDeleteButton();">
                    <div id="entry-${index}" class="entry-content">
                        ${entry.date} : (${entry['level-1-category']}-${entry['level-2-category']}) ${entry.description}
                    </div>
                    <button class="edit-button" 
                        onclick="editEntry('${entry.id}', '${entry.date}', '${entry['level-1-category']}', '${entry['level-2-category']}', \`${safeDescription}\`)">
                        編輯
                    </button>
                </div>`;
        });

        if (sortedEntries.length > 0) {
            allDataDiv.innerHTML = allDataText;
            if (!document.getElementById('copyButton')) {
                const copyButton = document.createElement('button');
                copyButton.id = 'copyButton';
                copyButton.innerText = '複製內容';
                copyButton.onclick = copyContent;
                allDataDiv.appendChild(copyButton);
            }
            if (!document.getElementById('deleteButton')) {
                const deleteButton = document.createElement('button');
                deleteButton.id = 'deleteButton';
                deleteButton.innerText = '刪除';
                deleteButton.onclick = deleteSelectedEntries;
                deleteButton.style.backgroundColor = '#FFCDD2';
                deleteButton.style.color = '#ffffff';
                allDataDiv.appendChild(deleteButton);
            }
            allDataDiv.style.display = 'block';
            toggleDeleteButton();
        } else {
            allDataDiv.style.display = 'none';
            allDataDiv.innerHTML = '';
        }
    })
    .catch(error => console.error("Error updating data summary:", error));
}



function toggleHighlight(checkbox, entryId) {
    const entryContent = document.getElementById(entryId);
    if (checkbox.checked) {
        entryContent.classList.add('highlighted');
    } else {
        entryContent.classList.remove('highlighted');
    }
}

function toggleDeleteButton() {
    const checkboxes = document.querySelectorAll('.entry input[type="checkbox"]');
    const deleteButton = document.getElementById('deleteButton');
    const isChecked = Array.from(checkboxes).some(checkbox => checkbox.checked);
    deleteButton.style.backgroundColor = isChecked ? '#D32F2F' : '#f7e9e9';
    deleteButton.disabled = !isChecked;
    deleteButton.style.display = 'inline';
}

function deleteSelectedEntries() {
    const selectedIDs = Array.from(document.querySelectorAll('.entry input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.dataset.id);

    fetch('/delete_entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIDs })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            updateTimeline();
            updateDataSummary();
        } else {
            console.error("Error deleting entries:", data.message);
        }
    })
    .catch(error => console.error("Fetch error:", error));
}

function copyContent() {
    const allDataDiv = document.getElementById('allData');
    const entries = allDataDiv.querySelectorAll('.entry-content');
    
    // Start with the patient summary
    const patientSummary = allDataDiv.querySelector('p').textContent;
    let contentToCopy = patientSummary + '\n\n'; // Add a new line after the summary

    // Append each entry's content
    entries.forEach(entry => {
        contentToCopy += entry.textContent + '\n';
    });

    // Copy the content to clipboard
    navigator.clipboard.writeText(contentToCopy.trim()).then(() => {
        alert('內容已複製！');
    }).catch(err => console.error('Error copying text: ', err));
}


function clearEntries() {
    const confirmation = confirm("您確定要清除所有歷史資料嗎？此操作無法撤銷。");
    
    if (confirmation) {
        fetch('/clear', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                document.getElementById('timeline').innerHTML = '';
                const patientNumberInput = document.getElementById('patient_number');
                const genderSelect = document.getElementById('gender');
                const ageInput = document.getElementById('age');

                patientNumberInput.disabled = false;
                genderSelect.disabled = false;
                ageInput.disabled = false;

                document.getElementById('allData').style.display = 'none';
                document.getElementById('allData').innerHTML = '';
                alert("歷史資料已成功清除！");
            }
        })
        .catch(error => console.error("Error clearing entries:", error));
    }
}


// Save Session 功能
function saveSession() {
    fetch('/show_all')
    .then(response => response.json())
    .then(data => {
        const dataToSave = {
            patient_info: data.patient_info,
            data_entries: data.data_entries
        };

        const dataStr = JSON.stringify(dataToSave, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "session_data.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    })
    .catch(error => console.error("Error saving session:", error));
}


function lockPatientInfo(patientInfo) {
    const patientNumberInput = document.getElementById('patient_number');
    const genderSelect = document.getElementById('gender');
    const ageInput = document.getElementById('age');

    patientNumberInput.value = patientInfo.patient_number;
    genderSelect.value = patientInfo.gender;
    ageInput.value = patientInfo.age;

    patientNumberInput.disabled = true;
    genderSelect.disabled = true;
    ageInput.disabled = true;
}

function uploadSession() {
    const fileInput = document.getElementById('uploadInput');
    const file = fileInput.files[0];

    if (!file) {
        alert("請選擇一個 JSON 檔案！");
        return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const sessionData = JSON.parse(event.target.result);
            fetch('/upload_session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    alert("會話資料已成功上傳！");
                    lockPatientInfo(sessionData.patient_info); // 鎖定欄位
                    updateTimeline();
                    updateDataSummary();
                } else {
                    console.error("Error uploading session:", data.message);
                    alert("上傳失敗，請檢查檔案格式！");
                }
            })
            .catch(error => console.error("Fetch error:", error));
        } catch (error) {
            console.error("Error parsing JSON file:", error);
            alert("無效的 JSON 檔案！");
        }
    };

    reader.readAsText(file);
}

function editEntry(id, date, level1Category, level2Category, description) {
    const editFormHtml = `
        <form id="editForm">
            <label for="edit-date">日期:</label>
            <input type="date" id="edit-date" name="date" value="${date}" required><br><br>
            
            <label for="edit-level1">第一層類別:</label>
            <select id="edit-level1" name="level-1-category" required>
                <option value="ER" ${level1Category === 'ER' ? 'selected' : ''}>ER</option>
                <option value="OPD" ${level1Category === 'OPD' ? 'selected' : ''}>OPD</option>
                <option value="IPD" ${level1Category === 'IPD' ? 'selected' : ''}>IPD</option>
            </select><br><br>
            
            <label for="edit-level2">第二層類別:</label>
            <select id="edit-level2" name="level-2-category" required>
                <option value="LIS" ${level2Category === 'LIS' ? 'selected' : ''}>LIS</option>
                <option value="RIS" ${level2Category === 'RIS' ? 'selected' : ''}>RIS</option>
                <option value="MEDICATION" ${level2Category === 'MEDICATION' ? 'selected' : ''}>MEDICATION</option>
                <option value="PATHOLOGY" ${level2Category === 'PATHOLOGY' ? 'selected' : ''}>PATHOLOGY</option>
                <option value="SURGICAL" ${level2Category === 'SURGICAL' ? 'selected' : ''}>SURGICAL</option>
                <option value="OTHER" ${level2Category === 'OTHER' ? 'selected' : ''}>OTHER</option>
            </select><br><br>
            
            <label for="edit-description">描述:</label>
            <textarea id="edit-description" name="description" rows="6" style="width: 100%;">${description}</textarea><br><br>
            
            <button type="button" class="save-button" onclick="submitEdit('${id}')">保存</button>
            <button type="button" class="cancel-button" onclick="cancelEdit()">取消</button>
        </form>`;
    
    const editFormContainer = document.createElement('div');
    editFormContainer.id = 'editFormContainer';
    editFormContainer.innerHTML = editFormHtml;
    document.body.appendChild(editFormContainer);
}

function cancelEdit() {
    const editFormContainer = document.getElementById('editFormContainer');
    if (editFormContainer) {
        editFormContainer.remove(); // 确保按下“取消”后移除弹窗
    }
}


function submitEdit(entryId) {
    const editForm = document.getElementById('editForm');
    const updatedEntry = {
        id: entryId,
        date: editForm['date'].value,
        'level-1-category': editForm['level-1-category'].value,
        'level-2-category': editForm['level-2-category'].value,
        description: editForm['description'].value
    };

    fetch('/edit_entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedEntry)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            alert('修改成功！');
            document.getElementById('editFormContainer').remove();
            updateTimeline();
            updateDataSummary();
        } else {
            console.error("Error editing entry:", data.message);
        }
    })
    .catch(error => console.error("Fetch error:", error));
}


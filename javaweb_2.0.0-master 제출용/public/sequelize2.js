/////////////////////////////////////////////

document.getElementById('profile_form2').addEventListener('submit', async (e) => {
    e.preventDefault();

    const files = document.querySelector('#input_profile').files;
    let profiles = [];
    let is_error = false;
    if(!files){
        return alert('파일을 먼저 선택하세요');
    }
    const filePromises = Array.from(files).map((file) => {
        if (file.name.split(".").pop().toLowerCase() === 'txt' || 'csv') {
            return new Promise((resolve, reject) => {
                readTextFile(file, (data) => {
                    profiles.push(data);
                    resolve();
                });
            });
        } else {
            alert(".txt/.csv파일만 입력해주세요");
            is_error = true;
        }
    });

    await Promise.all(filePromises);

    if(!is_error){
        const response = await fetch('/profiles/2',{
            method: 'POST',
            headers: {
                'Content-Type' : 'application/json'
            },
            body: JSON.stringify(profiles)
        });

        if (response.ok) {
            response.json().then(data => {
                //getList();
                alert(data.message);
            });
        } else {
            console.error('파일 전송 중 오류가 발생하였습니다.');
        }
    }
});

let result;
function readTextFile(file, save) {
    const reader = new FileReader();

    reader.onload = function (event) {
        const contents = event.target.result;
        const lines = contents.split(/\r?\n/);
        const parse = [[file.name]];
        const ext = file.name.split(".").pop().toLowerCase();

        let count = {
            total: 0,
            negative: 0,
            float: 0,
            string: 0,
            outlier: 0,
            missing: 0
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === "") continue;

            let row;
            if (ext === 'csv') {
                row = line.split(',');
            } else {
                row = line.split(/\t| +/);
            }

            if (i > 0) {
                for (let j = 1; j < row.length; j++) {
                    const cell = row[j]?.trim();
                    count.total++;

                    if (!cell || cell.toLowerCase() === "nan") {
                        count.missing++;
                    } else if (isNaN(cell)) {
                        count.string++;
                    } else if (cell.includes('.')) {
                        count.float++;
                    } else {
                        const value = parseInt(cell);
                        if (value < 0) count.negative++;
                        if (value > 2000) count.outlier++;
                    }
                }
            }

            parse.push(row);
        }

        // ✅ DB 저장 함수 호출
        result = saveValidationToDB(file.name, count);

        renderValidationTable(file.name, count);  // 결과 테이블 출력

        // 원래 로직
        save(parse);
    };

    reader.onerror = function () {
        console.error("파일을 읽는 중 오류 발생");
    };

    reader.readAsText(file, 'UTF-8');
}

async function saveValidationToDB(filename, count) {
    const percent = (num) => parseFloat(((num / count.total) * 100).toFixed(1));

    const data = {
        filename: filename,
        total: count.total,
        missing: count.missing,
        missing_ratio: percent(count.missing),
        string: count.string,
        string_ratio: percent(count.string),
        float: count.float,
        float_ratio: percent(count.float),
        negative: count.negative,
        negative_ratio: percent(count.negative),
        outlier: count.outlier,
        outlier_ratio: percent(count.outlier)
    };

    try {
        const res = await fetch('/profiles/save-validation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            console.error(`=====> ${filename} 저장 실패`);
        } else {
            console.log(`=====> ${filename} 저장 완료`);
            return res.json(res.data);
        }
    } catch (err) {
        console.error('DB 전송 중 오류:', err);
    }
}


// 결과 테이블 그리기
function renderValidationTable(filename, count) {
    const percent = (n) => count.total > 0 ? ((n / count.total) * 100).toFixed(1) + "%" : "-";

    const table = document.createElement('table');
    table.className = "table table-bordered table-striped mt-3";

    table.innerHTML = `
      <thead class="table-primary">
        <tr><th colspan="2">${filename} - 유효성 검증 결과</th></tr>
      </thead>
      <tbody>
        <tr><td>총 유효 셀 수</td><td>${count.total}</td></tr>
        <tr><td>결측치</td><td>${count.missing} (${percent(count.missing)})</td></tr>
        <tr><td>문자</td><td>${count.string} (${percent(count.string)})</td></tr>
        <tr><td>실수</td><td>${count.float} (${percent(count.float)})</td></tr>
        <tr><td>음수</td><td>${count.negative} (${percent(count.negative)})</td></tr>
        <tr><td>이상치(&gt;2000)</td><td>${count.outlier} (${percent(count.outlier)})</td></tr>
      </tbody>
    `;

    document.getElementById('validation-result-area').appendChild(table);

    drawValidationChart(filename, count);
}

function drawValidationChart(filename, count) {
    google.charts.load("current", { packages: ["corechart"] });
    google.charts.setOnLoadCallback(() => {
        const data = google.visualization.arrayToDataTable([
            ['항목', '건수'],
            ['결측치', count.missing],
            ['문자', count.string],
            ['실수', count.float],
            ['음수', count.negative],
            ['이상치(>2000)', count.outlier]
        ]);

        const options = {
            title: `${filename} - 유효성 분석 차트`,
            pieHole: 0.4,
            height: 400,
            chartArea: { width: '90%', height: '80%' },
            legend: { position: 'right', textStyle: { fontSize: 12 } },
            colors: ['#f39c12', '#3498db', '#1abc9c', '#e74c3c', '#9b59b6']
        };

        const chart = new google.visualization.PieChart(document.getElementById('chart_div'));
        chart.draw(data, options);
    });
}

/////////////////////////////////////////////
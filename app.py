from flask import Flask, render_template, request, jsonify
import plotly.graph_objs as go
from datetime import datetime
import textwrap
import uuid
import webbrowser
from threading import Timer

def open_browser():
    """Automatically open the web app in the default browser."""
    webbrowser.open_new("http://127.0.0.1:5001/")


app = Flask(__name__)

# In-memory storage of user inputs
data_entries = []
patient_info = {}

@app.route('/')
def index():
    return render_template('index.html')
    
@app.route('/edit_entry', methods=['POST'])
def edit_entry():
    try:
        edited_entry = request.json
        entry_id = edited_entry['id']
        
        # 找到要更新的資料並修改
        for entry in data_entries:
            if entry['id'] == entry_id:
                entry['date'] = edited_entry['date']
                entry['level-1-category'] = edited_entry['level-1-category']
                entry['level-2-category'] = edited_entry['level-2-category']
                entry['description'] = edited_entry['description']
                break
        else:
            return jsonify({'status': 'error', 'message': 'Entry not found!'}), 404

        return jsonify({'status': 'success', 'message': 'Entry updated successfully'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Error: {str(e)}'}), 500


@app.route('/next', methods=['POST'])
def next_entry():
    global patient_info
    if not patient_info:
        patient_info = {
            'patient_number': request.form['patient_number'],
            'gender': request.form['gender'],
            'age': request.form['age']
        }

    level1_category = request.form['level-1-category']
    level2_category = request.form['level-2-category']
    date = request.form['date']
    description = request.form['description']
    
    data_entries.append({
        'id': str(uuid.uuid4()),
        'date': date,
        'level-1-category': level1_category,
        'level-2-category': level2_category,
        'description': description,
    })
    return jsonify({'status': 'success', 'message': 'Entry added successfully'})

@app.route('/make', methods=['GET'])
def make_timeline():
    fig = go.Figure()
    
    # 一级类别的颜色映射
    category_colors = {
        "ER": "red",
        "OPD": "blue",
        "IPD": "green",
    }

    # 二级类别的形状映射
    category_shapes = {
        "LIS": "circle",
        "RIS": "triangle-up",
        "MEDICATION": "square",
        "PATHOLOGY": "diamond",
        "SURGICAL": "star",
        "OTHER": "cross"
    }

    sorted_entries = sorted(data_entries, key=lambda x: datetime.strptime(x['date'], "%Y-%m-%d"))
    
    for entry in sorted_entries:
        # 確保資料完整性
        date_str = entry.get('date', 'Unknown Date')
        level1 = entry.get('level-1-category', 'Unknown')
        level2 = entry.get('level-2-category', 'Unknown')
        description = entry.get('description', 'No Description')

        # 將長文字按每 30 個字符換行
        wrapped_description = "<br>".join(textwrap.wrap(description, width=30))
        hover_text = (
            f"<b>Date:</b> {date_str}<br>"
            f"<b>Category:</b> {level1}-{level2}<br>"
            f"<b>Description:</b> {wrapped_description}"  # 自动换行的描述
        )

        # 確保顏色和形狀有對應值，給 IPD 或 OTHER 類別提供預設值
        color = category_colors.get(level1, "gray")
        shape = category_shapes.get(level2, "circle")

        # 添加到圖表
        fig.add_trace(
            go.Scatter(
                x=[date_str],
                y=[level1],
                mode="markers+text",
                marker=dict(size=10, color=color, symbol=shape),
                text=[description[:8] + '...' if len(description) > 8 else description],
                hovertemplate=hover_text + "<extra></extra>",
                textposition="top center",
                showlegend=False
            )
        )

    # 添加僅用于說明二級類別形狀的圖例項
    for level2, shape in category_shapes.items():
        fig.add_trace(
            go.Scatter(
                x=[None], y=[None],
                mode="markers",
                marker=dict(size=10, symbol=shape, color="black"),
                name=f"{level2}"
            )
        )

    fig.update_layout(
        title=(f"Patient Timeline (Patient No: {patient_info.get('patient_number', 'N/A')}, "
               f"Gender: {patient_info.get('gender', 'N/A')}, Age: {patient_info.get('age', 'N/A')})"),
        xaxis_title="Date",
        yaxis_title="Category",
        showlegend=True,
        legend=dict(
            orientation="v",
            x=1.0,
            y=1,
            xanchor="left",
            yanchor="top"
        )
    )

    graphJSON = fig.to_json()
    return jsonify({'graphJSON': graphJSON})



@app.route('/show_all', methods=['GET'])
def show_all_data():
    return jsonify({
        'patient_info': patient_info,
        'data_entries': data_entries
    })

@app.route('/delete_entries', methods=['POST'])
def delete_entries():
    ids_to_delete = request.json.get('ids', [])
    global data_entries
    data_entries = [entry for entry in data_entries if entry['id'] not in ids_to_delete]
    return jsonify({'status': 'success'})

@app.route('/clear', methods=['POST'])
def clear_entries():
    global data_entries, patient_info
    data_entries.clear()
    patient_info.clear()
    return jsonify({'status': 'success', 'message': 'History cleared successfully'})

@app.route('/upload_session', methods=['POST'])
def upload_session():
    global data_entries, patient_info

    try:
        uploaded_data = request.json
        # Validate and update patient_info
        patient_info = uploaded_data.get('patient_info', {})
        if not all(k in patient_info for k in ['patient_number', 'gender', 'age']):
            return jsonify({'status': 'error', 'message': '缺少病人資訊或資料不完整！'})

        # Validate and update data_entries
        uploaded_entries = uploaded_data.get('data_entries', [])
        if not isinstance(uploaded_entries, list):
            return jsonify({'status': 'error', 'message': '無效的事件資料！'})

        data_entries = uploaded_entries
        return jsonify({'status': 'success', 'message': '會話資料已成功上傳！'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'發生錯誤：{str(e)}'})



if __name__ == '__main__':
    port = 5001

    Timer(1, open_browser).start()
    
    app.run(debug=False, port=port)

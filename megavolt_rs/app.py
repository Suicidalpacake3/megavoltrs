from flask import Flask, render_template, request, redirect, url_for, flash
import sqlite3
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'megavolt_rs_secret_2024'
DB = 'database.db'

def db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    c = db()
    c.execute('''CREATE TABLE IF NOT EXISTS clients(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, phone TEXT, email TEXT, address TEXT,
        notes TEXT, created_at TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS jobs(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_number TEXT UNIQUE NOT NULL,
        client_id INTEGER NOT NULL,
        device_type TEXT, brand TEXT, model TEXT, serial TEXT,
        issue TEXT, diagnosis TEXT, work_done TEXT,
        status TEXT DEFAULT 'Received',
        cost REAL DEFAULT 0,
        date_in TEXT, date_out TEXT,
        FOREIGN KEY(client_id) REFERENCES clients(id))''')
    c.commit(); c.close()

def next_job_number():
    c = db()
    row = c.execute("SELECT job_number FROM jobs ORDER BY id DESC LIMIT 1").fetchone()
    c.close()
    year = datetime.now().strftime('%y')
    if not row: return f"MV{year}-0001"
    try:
        n = int(row['job_number'].split('-')[1]) + 1
    except: n = 1
    return f"MV{year}-{n:04d}"

@app.route('/')
def dashboard():
    c = db()
    stats = {
        'total_clients': c.execute("SELECT COUNT(*) FROM clients").fetchone()[0],
        'active': c.execute("SELECT COUNT(*) FROM jobs WHERE status NOT IN ('Completed','Collected')").fetchone()[0],
        'completed': c.execute("SELECT COUNT(*) FROM jobs WHERE status='Completed'").fetchone()[0],
        'collected': c.execute("SELECT COUNT(*) FROM jobs WHERE status='Collected'").fetchone()[0],
    }
    recent = c.execute('''SELECT j.*, cl.name FROM jobs j 
        JOIN clients cl ON j.client_id=cl.id ORDER BY j.id DESC LIMIT 10''').fetchall()
    c.close()
    return render_template('dashboard.html', stats=stats, recent=recent)

@app.route('/clients')
def clients():
    q = request.args.get('q','')
    c = db()
    if q:
        rows = c.execute("SELECT * FROM clients WHERE name LIKE ? OR phone LIKE ? ORDER BY name",
                         (f'%{q}%',f'%{q}%')).fetchall()
    else:
        rows = c.execute("SELECT * FROM clients ORDER BY name").fetchall()
    c.close()
    return render_template('clients.html', clients=rows, q=q)

@app.route('/clients/add', methods=['POST'])
def add_client():
    f = request.form
    c = db()
    c.execute("INSERT INTO clients(name,phone,email,address,notes,created_at) VALUES(?,?,?,?,?,?)",
        (f['name'],f['phone'],f['email'],f['address'],f['notes'],datetime.now().isoformat()))
    c.commit(); c.close()
    flash('Client added','success')
    return redirect(url_for('clients'))

@app.route('/client/<int:cid>')
def client_detail(cid):
    c = db()
    client = c.execute("SELECT * FROM clients WHERE id=?",(cid,)).fetchone()
    jobs = c.execute("SELECT * FROM jobs WHERE client_id=? ORDER BY id DESC",(cid,)).fetchall()
    c.close()
    return render_template('client_detail.html', client=client, jobs=jobs)

@app.route('/client/<int:cid>/delete', methods=['POST'])
def del_client(cid):
    c = db(); c.execute("DELETE FROM clients WHERE id=?",(cid,)); c.commit(); c.close()
    return redirect(url_for('clients'))

@app.route('/jobs')
def jobs():
    q = request.args.get('q',''); status = request.args.get('status','')
    c = db()
    sql = '''SELECT j.*, cl.name FROM jobs j JOIN clients cl ON j.client_id=cl.id WHERE 1=1'''
    params = []
    if q:
        sql += " AND (j.job_number LIKE ? OR cl.name LIKE ? OR j.device_type LIKE ? OR j.brand LIKE ?)"
        params += [f'%{q}%']*4
    if status:
        sql += " AND j.status=?"; params.append(status)
    sql += " ORDER BY j.id DESC"
    rows = c.execute(sql, params).fetchall()
    c.close()
    return render_template('jobs.html', jobs=rows, q=q, status=status)

@app.route('/jobs/add', methods=['GET','POST'])
def add_job():
    c = db()
    if request.method == 'POST':
        f = request.form
        jn = f.get('job_number') or next_job_number()
        c.execute('''INSERT INTO jobs(job_number,client_id,device_type,brand,model,serial,issue,status,date_in)
            VALUES(?,?,?,?,?,?,?,?,?)''',
            (jn,f['client_id'],f['device_type'],f['brand'],f['model'],f['serial'],
             f['issue'],'Received',datetime.now().strftime('%Y-%m-%d')))
        c.commit(); c.close()
        flash(f'Job {jn} created','success')
        return redirect(url_for('jobs'))
    clients = c.execute("SELECT * FROM clients ORDER BY name").fetchall()
    c.close()
    return render_template('add_job.html', clients=clients, next_num=next_job_number())

@app.route('/job/<int:jid>')
def job_detail(jid):
    c = db()
    job = c.execute('''SELECT j.*, cl.name, cl.phone FROM jobs j 
        JOIN clients cl ON j.client_id=cl.id WHERE j.id=?''',(jid,)).fetchone()
    c.close()
    return render_template('job_detail.html', job=job)

@app.route('/job/<int:jid>/update', methods=['POST'])
def update_job(jid):
    f = request.form
    c = db()
    date_out = datetime.now().strftime('%Y-%m-%d') if f['status'] in ('Completed','Collected') else None
    c.execute('''UPDATE jobs SET diagnosis=?, work_done=?, status=?, cost=?, date_out=COALESCE(?,date_out)
        WHERE id=?''',(f['diagnosis'],f['work_done'],f['status'],f['cost'] or 0,date_out,jid))
    c.commit(); c.close()
    flash('Job updated','success')
    return redirect(url_for('job_detail', jid=jid))

@app.route('/job/<int:jid>/delete', methods=['POST'])
def del_job(jid):
    c = db(); c.execute("DELETE FROM jobs WHERE id=?",(jid,)); c.commit(); c.close()
    return redirect(url_for('jobs'))

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)

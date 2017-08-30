#-*- coding:utf-8 -*-
from flask import Flask
from flask import render_template, request, jsonify
import os,time
app = Flask(__name__)

def get_date():
    return time.strftime('%Y-%m-%d %H:%M:%S',time.localtime(time.time()))

def getip():
    try:
        return request.headers['x_forwarded_for']
    except KeyError, e:
        return request.remote_addr

@app.route("/miss")
def miss():
    cmd = request.args.get('cmd')
    time = get_date()
    ip = getip()
    f = os.path.join(os.environ.get('HOME'), 'cmd.txt')
    with open(f,'a') as txt:
        txt.write('%s|%s|%s\n' %(cmd,ip,time))
    return jsonify(cmd=cmd,ip=ip,time=time)

@app.route('/ip')
def ip():
    return getip()

if __name__ == "__main__":
    app.run(host='0.0.0.0',debug=True)

export async function put(url, opt) {
  opt = opt || {};
  opt.method = "PUT";
  return request(url, opt);
}

export async function post(url, opt) {
  opt = opt || {};
  opt.method = "POST";
  return request(url, opt);
}

export async function get(url, opt) {
  opt = opt || {};
  opt.method = "GET";
  return request(url, opt);
}

export async function request(url, opt) {
  opt = opt || {};

  // keep method and headers, if they're set
  let newOpt = {
    method: opt.method || "GET",
    headers: opt.headers
  };

  // data gets translated to JSON, put in body, 
  // also content-type header set to /applicationjson
  if (opt.data) {
    newOpt.body = JSON.stringify(opt.data);
    delete newOpt.data;
    
    if (!newOpt.headers) {
      newOpt.headers = {};
    }
    newOpt.headers["content-type"] = "application/json";
  }

  // file just gets put in body, no other changes
  if (opt.file) {
    newOpt.body = opt.file;
  }

  return await fetch(url, newOpt);
}
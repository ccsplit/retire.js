window.addEventListener('load', function() {
	sendMessage('enabled?', null, function(response) { 
		document.querySelector("input[type=checkbox]#enabled").checked = response.enabled;
	});

	document.querySelector("input[type=checkbox]#enabled").addEventListener('click', function() {
		console.log(this.checked);
		chrome.browserAction.setIcon({ path: this.checked ? "icons/icon48.png" : "icons/icon_bw48.png" });
		sendMessage('enable', this.checked, null);
	}, false);

	document.querySelector("input[type=checkbox]#unknown").addEventListener('click', function() {
		console.log(this.checked);
		document.getElementById("results").className = this.checked ? "" : "hideunknown";
	}, false);

	queryForResults();
	setInterval(queryForResults, 5000);
  document.querySelector("#copy_urls").addEventListener("click", copyUrls);
}, false);

function queryForResults() {
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
	  chrome.tabs.sendMessage(tabs[0].id, { getDetected: 1 }, function(response) {
	    show(response);
	    console.log(response);
	  });
	});	
}

function copyToClipboard(str) {
    /* ——— Derived from: https://hackernoon.com/copying-text-to-clipboard-with-javascript-df4d4988697f
           improved to add iOS device compatibility——— */
    const el = document.createElement('textarea'); // Create a <textarea> element

    let storeContentEditable = el.contentEditable;
    let storeReadOnly = el.readOnly;

    el.value = str; // Set its value to the string that you want copied
    el.contentEditable = true;
    el.readOnly = false;
    el.setAttribute('readonly', false); // Make it readonly false for iOS compatability
    el.setAttribute('contenteditable', true); // Make it editable for iOS
    el.style.position = 'absolute';
    el.style.left = '-9999px'; // Move outside the screen to make it invisible
    document.body.appendChild(el); // Append the <textarea> element to the HTML document
    const selected =
        document.getSelection().rangeCount > 0 // Check if there is any content selected previously
            ? document.getSelection().getRangeAt(0) // Store selection if found
            : false; // Mark as false to know no selection existed before
    el.select(); // Select the <textarea> content
    el.setSelectionRange(0, 999999);
    document.execCommand('copy'); // Copy - only works as a result of a user action (e.g. click events)
    document.body.removeChild(el); // Remove the <textarea> element
    if (selected) {
        // If a selection existed before copying
        document.getSelection().removeAllRanges(); // Unselect everything on the HTML document
        document.getSelection().addRange(selected); // Restore the original selection
    }

    el.contentEditable = storeContentEditable;
    el.readOnly = storeReadOnly;
}

function copyUrls() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
    chrome.tabs.sendMessage(tabs[0].id, {getDetected: 1}, function(response){
      components = new Set()
      comp_names = new Set()
      urls = new Set()
      response.forEach(function(vuln){
        if (vuln.vulnerable) {
          components.add(vuln.url);
          vuln.results.forEach(function(res) {
            if (res.vulnerabilities.length > 0) {
              comp_names.add(res.component)
              res.vulnerabilities.forEach(function(res_vuln){
                res_vuln.info.forEach(function(i){
                  urls.add(i);
                })
              });
            }
          });
        }
      })
      copyToClipboard(`Vulnerability URLs:\n${Array.from(urls).sort().join('\n')}\n\nVulnerable Components: (${Array.from(comp_names).sort().join(", ")})\n${Array.from(components).sort().join("\n")}`)
      alert("Successfully copied.")
    })
  })
}

function show(totalResults) {
	document.getElementById("results").innerHTML="";
	console.log(totalResults);
	var merged = {};
	totalResults.forEach(rs => {
		merged[rs.url] = merged[rs.url] || { url: rs.url, results: [] };
		merged[rs.url].results = merged[rs.url].results.concat(rs.results);
	});

	var results = Object.keys(merged).map(k => merged[k]);
	results.forEach(function(rs) {
		rs.results.forEach(function(r) {
			r.url = rs.url;
			r.vulnerable = r.vulnerabilities && r.vulnerabilities.length > 0;
		});
		if (rs.results.length == 0) {
			rs.results = [{ url: rs.url, unknown: true, component: "unknown" }]
		}
	});
	var res = results.reduce(function(x, y) { return x.concat(y.results); }, []);
	res.sort(function(x, y) {
		if (x.unknown != y.unknown) { return x.unknown ? 1 : -1 }
		if (x.vulnerable != y.vulnerable) { return x.vulnerable ? -1 : 1 }
		return (x.component + x.version + x.url).localeCompare(y.component + y.version + y.url);
	});
	res.forEach(function(r) {
		var tr = document.createElement("tr");
		document.getElementById("results").appendChild(tr);				
		if (r.unknown) {
			tr.className = "unknown";
			td(tr).innerText = "-";
			td(tr).innerText = "-";
			td(tr).innerHTML = "Did not recognize " + r.url;
		} else {
			td(tr).innerText = r.component;
			td(tr).innerText = r.version;
			var vulns = td(tr);
			vulns.innerHTML = "Found in " + r.url;
		}
		if (r.vulnerabilities && r.vulnerabilities.length > 0) {
			tr.className = "vulnerable";
			vulns.innerHTML += "<br>Vulnerability info: ";
			var table = document.createElement("table");
			vulns.appendChild(table);
			r.vulnerabilities.forEach(function(v) {
				var tr = document.createElement("tr");
				table.appendChild(tr);
				td(tr).innerText = v.severity || " ";
				td(tr).innerText = v.identifiers ? v.identifiers.mapOwnProperty(function(val) { return val }).flatten().join(" ") : " ";
				var info = td(tr);
				v.info.forEach(function(u, i) {
					var a = document.createElement("a");
					a.innerText = i + 1;
					a.href = u;
					a.title = u;
					a.target = "_blank";
					info.appendChild(a);
				});
			})
		}
	})
}
function td(tr) {
	var cell = document.createElement("td");
	tr.appendChild(cell);
	return cell;
}

Object.prototype.forEachOwnProperty = function(f) {
	mapOwnProperty(f);
};
Object.prototype.mapOwnProperty = function(f) {
	var results = [];
	for(var i in this) {
		if (this.hasOwnProperty(i)) results.push(f(this[i], i));
	}
	return results;
};

Array.prototype.flatten = function() { return this.reduce((a,b) => a.concat(b), []) }

function sendMessage(message, data, callback) {
	chrome.extension.sendRequest({ to: 'background', message: message, data: data }, function(response) { callback && callback(response) });
}

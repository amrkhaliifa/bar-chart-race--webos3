var sheetURL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRuOz_KYEdrt8WrAqcUBAQYBUleVsQGufTRSov0NbOr2n3qKxNpMRO-MEXNdb4ugc_HYAP912l7kAOl/pub?gid=0&single=true&output=csv";

function loadCSV(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      callback(null, xhr.responseText);
    }
  };
  xhr.send();
}

function parseCSV(text) {
  var rows = [];
  var row = [];
  var field = "";
  var insideQuotes = false;

  for (var i = 0; i < text.length; i++) {
    var c = text[i];

    if (c === '"') {
      insideQuotes = !insideQuotes;
    } else if (c === "," && !insideQuotes) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !insideQuotes) {
      if (field.length || row.length) {
        row.push(field);
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += c;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  var headers = rows.shift();

  var data = [];
  for (var r = 0; r < rows.length; r++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c].trim()] = (rows[r][c] || "").trim();
    }
    data.push(obj);
  }

  return data;
}

function buildSales(rows) {
  var sales = [];

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];

    var sale = r.Sales || "";
    sale = sale.replace(/,/g, "");

    sales.push({
      date: new Date(r.Date),
      agent: r.AgentName,
      title: r.Title,
      sales: Number(sale) || 0,
    });
  }

   
}



function buildSales(rows) {
  var sales = [];

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];

    var sale = r.Sales || "";
    sale = sale.replace(/,/g, "");

    sales.push({
      date: new Date(r.Date),
      agent: r.AgentName,
      title: r.Title,
      sales: Number(sale) || 0,
    });
  }

  return sales;
}


var svg = document.getElementById("chart");

var width = window.innerWidth;
var height = window.innerHeight;

svg.setAttribute("width", width);
svg.setAttribute("height", height);

var marginTop = 80;
var chartHeight = height - marginTop - 20;

function calcLayout(groups) {
  var titles = Object.keys(groups);
  var minW = 220;

  var total = 0;
  for (var i = 0; i < titles.length; i++) {
    total += groups[titles[i]].length;
  }

  var free = width - minW * titles.length;
  var x = 10;

  var layout = {};

  for (var j = 0; j < titles.length; j++) {
    var t = titles[j];
    var w = minW + (groups[t].length / total) * free;
    layout[t] = { x: x, width: w };
    x += w;
  }

  return layout;
}

function groupByTitle(list) {
  var g = {
    PA: [],
    PC: [],
    Supervisor: [],
    "Team Leader": [],
  };

  for (var i = 0; i < list.length; i++) {
    var t = list[i].title;
    if (g[t]) g[t].push(list[i]);
  }

  return g;
}



function buildFrames(sales) {
  var map = {}; // date -> agent -> total

  for (var i = 0; i < sales.length; i++) {
    var s = sales[i];
    var d = s.date.toISOString().slice(0, 10);

    if (!map[d]) map[d] = {};
    if (!map[d][s.agent])
      map[d][s.agent] = {
        name: s.agent,
        title: s.title,
        value: 0,
      };

    map[d][s.agent].value += s.sales;
  }

  var dates = Object.keys(map).sort();

  var raceFrames = [];
  for (var j = 0; j < dates.length; j++) {
    var day = dates[j];
    var list = [];

    for (var k in map[day]) {
      list.push(map[day][k]);
    }

    // sort by value desc
    list.sort(function (a, b) {
      return b.value - a.value;
    });

    raceFrames.push({
      date: day,
      data: list,
    });
  }

  return raceFrames;
}

function drawFrame(frame) {
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }

  var groups = groupByTitle(frame.data);
  var layout = calcLayout(groups);

  var rowH = 28;

  for (var title in groups) {
    var panelX = layout[title].x;
    var panelW = layout[title].width;

    var t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", panelX + panelW / 2);
    t.setAttribute("y", 40);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("font-size", "22");
    t.setAttribute("font-weight", "700");
    t.textContent = title;
    svg.appendChild(t);

    var list = groups[title];

    var max = 1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].value > max) max = list[i].value;
    }

    for (var r = 0; r < list.length; r++) {
      var d = list[r];

      var barW = (d.value / max) * (panelW - 40);

      var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", panelX + 10);
      rect.setAttribute("y", marginTop + r * rowH);
      rect.setAttribute("width", barW);
      rect.setAttribute("height", rowH * 0.7);
      rect.setAttribute("rx", 6);
      rect.setAttribute("fill", "#3b82f6");
      svg.appendChild(rect);

      var name = document.createElementNS("http://www.w3.org/2000/svg", "text");
      name.setAttribute("x", panelX + 14);
      name.setAttribute("y", marginTop + r * rowH + rowH / 2);
      name.setAttribute("dominant-baseline", "middle");
      name.setAttribute("font-size", "12");
      name.textContent = d.name;
      svg.appendChild(name);
    }
  }
}

loadCSV(sheetURL, function (err, text) {
  if (err) {
    console.error("Load error");
    return;
  }

  var rows = parseCSV(text);
  console.log("Rows:", rows.length);

  var sales = buildSales(rows);
  console.log("Sales:", sales.length);

  var raceFrames = buildFrames(sales);
  console.log("Frames:", raceFrames.length);
  console.log("First frame:", raceFrames[0]);

  if (!raceFrames.length) {
    console.error("NO FRAMES");
    return;
  }

  drawFrame(raceFrames[0]);
});

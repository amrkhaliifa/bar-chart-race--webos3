var sheetURL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRuOz_KYEdrt8WrAqcUBAQYBUleVsQGufTRSov0NbOr2n3qKxNpMRO-MEXNdb4ugc_HYAP912l7kAOl/pub?gid=0&single=true&output=csv";

var nodes = {}; // agent -> {rect, text}
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

var raceFrames = [];

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
  var dayMap = {}; // date -> agent -> cumulative total
  var allAgents = {};

  // sort by date first
  sales.sort(function (a, b) {
    return a.date - b.date;
  });

  for (var i = 0; i < sales.length; i++) {
    var s = sales[i];

    var d =
      s.date.getFullYear() +
      "-" +
      (s.date.getMonth() + 1) +
      "-" +
      s.date.getDate();

    if (!dayMap[d]) dayMap[d] = {};

    // carry previous totals forward
    for (var a in allAgents) {
      dayMap[d][a] = {
        name: a,
        title: allAgents[a].title,
        value: allAgents[a].value,
      };
    }

    if (!dayMap[d][s.agent]) {
      dayMap[d][s.agent] = {
        name: s.agent,
        title: s.title,
        value: 0,
      };
    }

    dayMap[d][s.agent].value += s.sales;

    // update master totals
    allAgents[s.agent] = dayMap[d][s.agent];
  }

  var dates = Object.keys(dayMap).sort();

  var frames = [];
  for (var j = 0; j < dates.length; j++) {
    var list = [];
    var m = dayMap[dates[j]];

    for (var k in m) list.push(m[k]);

    list.sort(function (a, b) {
      return b.value - a.value;
    });

    frames.push({
      date: dates[j],
      data: list,
    });
  }

  return frames;
}

var current = 0;

function play() {
  drawFrame(raceFrames[current]);

  current++;
  if (current >= raceFrames.length) current = 0;

  setTimeout(play, 1500); // change day every 1.5 sec
}

function animateAttr(el, attr, target, duration) {
  var start = Number(el.getAttribute(attr)) || 0;
  var diff = target - start;
  var startTime = Date.now();

  function step() {
    var t = Date.now() - startTime;
    var p = t / duration;
    if (p > 1) p = 1;

    var val = start + diff * p;
    el.setAttribute(attr, val);

    if (p < 1) requestAnimationFrame(step);
  }

  step();
}



function drawFrame(frame) {
  var groups = groupByTitle(frame.data);
  var layout = calcLayout(groups);
  var rowH = 28;

  for (var title in groups) {
    var panelX = layout[title].x;
    var panelW = layout[title].width;

    // ---- PANEL TITLE (create once) ----
    if (!nodes["title_" + title]) {
      var t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", panelX + panelW / 2);
      t.setAttribute("y", 40);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("font-size", "22");
      t.setAttribute("font-weight", "700");
      t.textContent = title;
      svg.appendChild(t);
      nodes["title_" + title] = t;
    }

    var list = groups[title];

    // max value for scale
    var max = 1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].value > max) max = list[i].value;
    }

    for (var r = 0; r < list.length; r++) {
      var d = list[r];
      var id = d.name;

      var barW = (d.value / max) * (panelW - 40);
      var y = marginTop + r * rowH;

      // ---- CREATE IF NOT EXISTS ----
      if (!nodes[id]) {
        var rect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect.setAttribute("x", panelX + 10);
        rect.setAttribute("y", y);
        rect.setAttribute("height", rowH * 0.7);
        rect.setAttribute("rx", 6);
        rect.setAttribute("fill", "#3b82f6");
        svg.appendChild(rect);

        var name = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text",
        );
        name.setAttribute("x", panelX + 14);
        name.setAttribute("y", y + rowH / 2);
        name.setAttribute("dominant-baseline", "middle");
        name.setAttribute("font-size", "12");
        name.textContent = d.name;
        svg.appendChild(name);

        nodes[id] = { rect: rect, text: name };
      }

      // ---- UPDATE POSITION + WIDTH (ANIMATE) ----
      animateAttr(nodes[id].rect, "y", y, 800);
      animateAttr(nodes[id].rect, "width", barW, 800);

      animateAttr(nodes[id].text, "y", y + rowH / 2, 800);
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

  raceFrames = buildFrames(sales);
  console.log("Frames:", raceFrames.length);
  console.log("First frame:", raceFrames[0]);
  console.log("First sale date:", sales[0].date);
  console.log("Last sale date:", sales[sales.length - 1].date);

  if (!raceFrames.length) {
    console.error("NO FRAMES");
    return;
  }
current = 0;
play();
  
});




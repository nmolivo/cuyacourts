const margin = { top: 40, right: 30, bottom: 50, left: 60 },
    chartWidth = 560 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom,
    colWidth = 160;

const wrapper = d3.select("#annual-caseload-chart")
    .style("display", "block")
    .style("width", (colWidth + chartWidth + margin.left + margin.right) + "px")
    .style("overflow", "visible")
    .style("margin-bottom", "60px");

const topRow = wrapper.append("div")
    .style("display", "flex")
    .style("align-items", "flex-start");

const leftLegend = topRow.append("div")
    .attr("id", "legend-left")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "4px")
    .style("font-size", "10px")
    .style("color", "#888")
    .style("width", colWidth + "px")
    .style("flex-shrink", "0")
    .style("padding-top", margin.top + "px");

const chartArea = topRow.append("div");

const svg = chartArea.append("svg")
    .attr("width", chartWidth + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

const bottomLegend = wrapper.append("div")
    .attr("id", "legend-bottom")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(4, 1fr)")
    .style("gap", "4px 8px")
    .style("margin-top", "8px")
    .style("font-size", "10px")
    .style("color", "#888")
    .style("width", (colWidth + chartWidth + margin.left + margin.right) + "px");

d3.csv("assets/data/annual_case_load_by_judge.csv").then(function (data) {

    data.forEach(d => {
        d.start_year = +d.start_year;
        d.count = +d.count;
    });

    const recentYears = [2021, 2022, 2023];
    const judgeMap = {};
    data.forEach(d => {
        if (!judgeMap[d.judge_name]) judgeMap[d.judge_name] = {};
        judgeMap[d.judge_name][d.start_year] = d.count;
    });

    const judgesSorted = Object.entries(judgeMap)
        .map(([judge, years]) => ({
            judge,
            recentTotal: recentYears.reduce((s, y) => s + (years[y] || 0), 0),
            years
        }))
        .sort((a, b) => b.recentTotal - a.recentTotal);

    const allYears = [...new Set(data.map(d => d.start_year))].sort();

    const color = d3.scaleOrdinal(d3.schemeTableau10)
        .domain(judgesSorted.map(d => d.judge));

    const x = d3.scaleLinear()
        .domain(d3.extent(allYears))
        .range([0, chartWidth]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count)])
        .range([height, 0]);

    svg.append("defs").append("clipPath")
        .attr("id", "chart-clip")
        .append("rect")
        .attr("width", chartWidth)
        .attr("height", height)
        .attr("x", 0)
        .attr("y", 0);

    svg.append("text")
        .attr("x", chartWidth / 2)
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "500")
        .text("Annual caseload by judge");

    // x axis
    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(allYears.length))
        .selectAll("text")
        .style("fill", "#888");
    // y axis 
    svg.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(y))
        .selectAll("text")
        .style("fill", "#888");

    svg.append("text")
        .attr("x", chartWidth / 2)
        .attr("y", height + 40)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#888")
        .text("Year");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -45)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#888")
        .text("Number of cases");

    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-chartWidth).tickFormat(""))
        .selectAll("line")
        .style("stroke", "rgba(136,135,128,0.15)");

    svg.select(".grid .domain").remove();

    const lineGen = d3.line()
        .defined(d => d !== null)
        .x(d => x(d.year))
        .y(d => y(d.count));

    const lines = {};

    judgesSorted.forEach(({ judge, years }) => {
        const lineData = allYears
            .map(y => years[y] != null ? { year: y, count: years[y] } : null)
            .filter(d => d !== null);

        const path = svg.append("path")
            .datum(lineData)
            .attr("fill", "none")
            .attr("stroke", color(judge))
            .attr("stroke-width", 1.5)
            .attr("opacity", 0.85)
            .attr("clip-path", "url(#chart-clip)")
            .attr("d", lineGen);

        lines[judge] = path;
    });

    // tooltip elements
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "chart-tooltip")
        .style("position", "fixed")
        .style("background", "white")
        .style("border", "0.5px solid #ccc")
        .style("border-radius", "6px")
        .style("padding", "6px 10px")
        .style("font-size", "11px")
        .style("color", "var(--color-default)")
        .style("font-family", "var(--font-primary)")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("box-shadow", "0 2px 6px rgba(0,0,0,0.1)")
        .style("z-index", "9999");

    const hoverCircle = svg.append("circle")
        .attr("r", 5)
        .attr("fill", "white")
        .attr("stroke", "#444")
        .attr("stroke-width", 2)
        .style("opacity", 0)
        .style("pointer-events", "none");

    // invisible overlay to capture mouse events
    const overlay = svg.append("rect")
        .attr("width", chartWidth)
        .attr("height", height)
        .attr("fill", "none")
        .style("pointer-events", "all");

    // active scales — updated on zoom
    let activeX = x;
    let activeY = y;

    function updateTooltip(event) {
        const [mx, my] = d3.pointer(event);
        const year = Math.round(activeX.invert(mx));

        if (year < allYears[0] || year > allYears[allYears.length - 1]) {
            hoverCircle.style("opacity", 0);
            tooltip.style("opacity", 0);
            return;
        }

        let closestJudge = null;
        let closestDist = Infinity;

        judgesSorted.forEach(({ judge, years }) => {
            const val = years[year];
            if (val == null) return;
            const dist = Math.abs(activeY(val) - my);
            if (dist < closestDist) {
                closestDist = dist;
                closestJudge = { judge, val };
            }
        });

        if (!closestJudge || closestDist > 30) {
            hoverCircle.style("opacity", 0);
            tooltip.style("opacity", 0);
            return;
        }

        const { judge, val } = closestJudge;

        hoverCircle
            .attr("cx", activeX(year))
            .attr("cy", activeY(val))
            .attr("stroke", color(judge))
            .style("opacity", 1);

        tooltip
            .style("opacity", 1)
            .style("left", (event.clientX + 14) + "px")
            .style("top", (event.clientY - 28) + "px")
            .html(`<strong>${judge}</strong><br/>${year}: ${val} cases`);
    }

    overlay.on("mousemove", updateTooltip);

    overlay.on("mouseleave", function () {
        hoverCircle.style("opacity", 0);
        tooltip.style("opacity", 0);
    });

    // zoom
    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .translateExtent([[0, 0], [chartWidth, height]])
        .extent([[0, 0], [chartWidth, height]])
        .on("zoom", function (event) {
            activeX = event.transform.rescaleX(x);
            activeY = event.transform.rescaleY(y);

            // update axes
            svg.select(".x-axis")
                .call(d3.axisBottom(activeX)
                    .tickFormat(d3.format("d"))
                    .tickValues(allYears.filter(y => y >= Math.floor(activeX.domain()[0]) && y <= Math.ceil(activeX.domain()[1])))
                );
            svg.select(".y-axis")
                .call(d3.axisLeft(activeY));

            // update all lines
            const newLineGen = d3.line()
                .defined(d => d !== null)
                .x(d => activeX(d.year))
                .y(d => activeY(d.count));

            Object.entries(lines).forEach(([judge, path]) => {
                const lineData = allYears
                    .map(yr => judgeMap[judge][yr] != null ? { year: yr, count: judgeMap[judge][yr] } : null)
                    .filter(d => d !== null);
                path.attr("d", newLineGen(lineData));
            });
        });

    // attach zoom to overlay
    overlay.call(zoom);

    // double click to reset
    overlay.on("dblclick", function () {
        overlay.call(zoom.transform, d3.zoomIdentity);
    });

    // figure out how many judges fit in the left column alongside the chart
    const chartHeightPx = height;
    const itemHeightPx = 20;
    const leftColCount = Math.floor(chartHeightPx / itemHeightPx) + 1;

    function makeLegendItem(container, judge) {
        const item = container.append("span")
            .style("display", "flex")
            .style("align-items", "center")
            .style("gap", "5px")
            .style("cursor", "pointer")
            .style("padding", "2px 5px")
            .style("border-radius", "4px")
            .style("min-width", "0");

        item.append("span")
            .style("display", "inline-block")
            .style("width", "14px")
            .style("height", "3px")
            .style("background", color(judge))
            .style("border-radius", "2px")
            .style("flex-shrink", "0");

        item.append("span")
            .style("overflow", "hidden")
            .style("text-overflow", "ellipsis")
            .style("white-space", "nowrap")
            .text(judge);

        item.on("mouseenter", function () {
            Object.entries(lines).forEach(([j, path]) => {
                path.attr("stroke-width", j === judge ? 3 : 0.4)
                    .attr("opacity", j === judge ? 1 : 0.15);
            });
            item.style("background", "#f1efe8");
        });

        item.on("mouseleave", function () {
            Object.values(lines).forEach(path => {
                path.attr("stroke-width", 1.5).attr("opacity", 0.85);
            });
            item.style("background", "");
        });
    }

    judgesSorted.forEach(({ judge }, i) => {
        if (i < leftColCount) {
            makeLegendItem(leftLegend, judge);
        } else {
            makeLegendItem(bottomLegend, judge);
        }
    });
});

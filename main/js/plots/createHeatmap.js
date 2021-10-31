// Async function to create a d3 heatmap for a given independent variable and a set of genes

// dataInput is the array os JSONs of gene expression data to visualize
// clinicalData is the array containing clinical data
// divObject is the div object on the html page to build the plot

createHeatmap = async function (dataInput, clinicalData, divObject) {

    ///// DATA PROCESSING /////
    // Set the columns to be the set of TCGA participant barcodes 'myGroups' and the rows to be the set of genes called 'myVars'
    let myGroups = d3.map(dataInput, d => d.tcga_participant_barcode).keys();
    let myVars = d3.map(dataInput, d => d.gene).keys();

    // Get unique cohort IDs (for title)
    const cohortIDs = d3.map(dataInput, d => d.cohort).keys();

    // Get unique TCGA IDs
    var unique_ids = d3.map(dataInput, d => d.tcga_participant_barcode).keys();

    // Cluster IDs by expression:
    // 1. Merge data into wide format (for hclust algorithm)
    var data_merge = mergeExpression(dataInput);

    // sort groups based on doCluster flag (default=false, controlled by checkbox)
    // false: sort by mean expression (default)
    // true : sort by hierarchichal clustering
    var doCluster = false, clusterReady = false, clust_results, sortOrder;
    function sortGroups() {
        if (doCluster && !clusterReady) { // do hierarchical clustering, if not already done (clusterReady)
            // call clustering function from hclust library
            clust_results = clusterData({ data: data_merge, key: 'exps' });
            sortOrder = clust_results.order; // extract sort order from clust_results
            clusterReady = true;
        } else if (doCluster && clusterReady) { // if clustering already done, no need to re-run
            sortOrder = clust_results.order;
        }
        else { // sort by mean expression
            // compute expression means
            const ngene = data_merge[0].genes.length;
            const means = data_merge.map(el => (el.exps.reduce((acc, val) => acc + val, 0)) / ngene);

            // sort by mean value
            sortOrder = new Array(data_merge.length);
            for (var i = 0; i < data_merge.length; ++i) sortOrder[i] = i;
            sortOrder.sort((a, b) => { return means[a] > means[b] ? -1 : 1; });
        }
        myGroups = unique_ids;
        myGroups = sortOrder.map(i => myGroups[i]);
    };
    sortGroups();


    ///// BUILD SVG OBJECTS /////
    // Set up dimensions:
    var margin = { top: 80, right: 30, space: 5, bottom: 30, left: 100 },
        frameWidth = 1250,
        heatWidth = frameWidth - margin.left - margin.right,
        legendWidth = 50,
        heatHeight = 300,
        sampTrackHeight = 25,
        dendHeight = Math.round(heatHeight / 2),
        frameHeight = margin.top + heatHeight + margin.space + dendHeight + margin.bottom;

    // Create svg object frame for the plots
    var svg_frame = divObject.append("svg")
        //.attr("viewBox", '0 0 '+frameWidth+' '+frameHeight)
        .attr('width', frameWidth)
        .attr('height', frameHeight);

    // Add title listing cohorts
    svg_frame.append("text")
        .attr('id', 'heatmapTitle')
        .attr("x", margin.left)
        .attr("y", margin.top - 25)
        .style("font-size", "26px")
        .text("Gene Expression Heatmap for " + cohortIDs.join(' and '));

    // Add nested svg for dendrogram
    var svg_dendrogram = svg_frame
        .append("svg")
        .attr("class", "dendrogram")
        .attr("width", heatWidth)
        .attr("height", dendHeight)
        .attr("x", margin.left)
        .attr("y", margin.top);

    // Add nested svg for sampletrack
    var svg_sampletrack = svg_frame
        .append("svg")
        .attr("class", "sampletrack")
        .attr("width", frameWidth)
        .attr("height", margin.space + sampTrackHeight)
        .attr("y", margin.top + dendHeight + margin.space)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.space + ")");

    // Add nested svg for heatmap
    var svg_heatmap = svg_frame
        .append("svg")
        .attr("class", "heatmap")
        .attr("width", frameWidth)
        .attr("height", heatHeight + margin.space + margin.bottom)
        .attr("y", margin.top + dendHeight + margin.space + sampTrackHeight + margin.space)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.space + ")");

    // Create div for tooltip
    var tooltip = divObject
        .append("div")
        .style("opacity", 0)
        .attr("class", "tooltip")
        .style("border", "solid")
        .style("border-width", "2px")
        .style("border-radius", "5px")
        .style("padding", "5px")
        .style('width', frameWidth + 'px');

    // Add div for sample track legend
    var div_sampLegend = divObject
        .append("div")
        .attr("class", "legend")
        .style("border", "solid")
        .style("border-width", "2px")
        .style("border-radius", "5px")
        .style("padding", "5px")
        .style('width', frameWidth + 'px');
    div_sampLegend
        .append("text")
        .style("font-size", "18px")
        .text("Clinical Feature Sample Tracks Legend:");
    var svg_sampLegend = div_sampLegend
        .append("div")
        .attr('id', 'legend')
        .attr('class', 'viewport')
        .style('overflow', 'scroll')
        .append("svg")
        .attr("class", "sampLegend")
        .attr("width", frameWidth)
        .attr("height", sampTrackHeight + 2 * margin.space)
        .append("g")
        .attr("transform", "translate(" + margin.space + "," + margin.space + ")");

    // Create div for sorting options (checkboxes)
    var sortOptionDiv = divObject
        .append('div')
        .text('Sort options: ');
    var sortCurrentText = sortOptionDiv
        .append('tspan')
        .text('mean expression (default)');
    var sortOptionTable = sortOptionDiv.append('td'); // make a table for different sort options, only hclust for now
    sortOptionTable
        .append('tspan')
        .text('hclust\xa0')
        .append('input')
        .attr('type', 'checkbox')
        .style('opacity', 1) // have to include these two lines... for some reason defaults to 0 and 'none'
        .style('pointer-events', 'auto') // ^ defaults to 'none', which makes checkbox non-responsive?
        .on('change', function () {
            // function to update state of sortCurrentText and doCluster
            // can also check state anywhere with sortOptionDiv.select("#hclustcheck").property("checked")
            sortCurrentText.text(this.checked ? 'hierarchical clustering' : 'mean expression (default)')
            doCluster = (this.checked ? true : false)
        });
    sortOptionDiv.append('button')
        .attr('type', 'button')
        .attr('id', 'updateHeatmapButton')
        .text('Update heatmap'); // add update behavior later (after update function defined)


    ///// Build the Axis and Color Scales Below /////
    // Build x scale for heatmap
    let x = d3.scaleBand()
        .range([0, heatWidth - legendWidth])
        .domain(myGroups);

    // Build y scale for heatmap
    let y = d3.scaleBand()
        .range([0, heatHeight])
        .domain(myVars);

    // Define minZ and maxZ for the color interpolator
    let minZ = -2,
        maxZ = 2;

    // Position scale for the legend
    let zScale = d3.scaleLinear().domain([minZ, maxZ]).range([heatHeight, 0]);

    // Create zArr array to build legend:
    let zArr = [];
    let step = (maxZ - minZ) / (1000 - 1);
    for (var i = 0; i < 1000; i++) {
        zArr.push(minZ + (step * i));
    };

    // Build color scale for gene expression (z-score)
    let interpCol_exp = d3.interpolateRgbBasis(["blue", "white", "red"])
    let colorScale_exp = d3.scaleSequential()
        .interpolator(interpCol_exp) // d3 interpolated color gradient
        .domain([minZ, maxZ]);


    // Declare data structures for dendrogram layout
    var cluster, data;
    var root = { data: { height: [] } };

    // Elbow function for dendrogram connections
    function elbow(d) {
        const scale = dendHeight / root.data.height;
        return "M" + d.parent.x + "," + (dendHeight - d.parent.data.height * scale) + "H" + d.x + "V" + (dendHeight - d.data.height * scale);
    };


    ///// Build the Mouseover Tool Functions /////
    // Three functions that change the tooltip when user hover / move / leave a cell
    let mouseover = function (d) {
        // Make tooltip appear and color heatmap object black
        tooltip.style("opacity", 1);
        d3.select(this).style("fill", "black");
        // Make dendrogram path bold
        let id_ind = unique_ids.indexOf(d.tcga_participant_barcode);
        svg_dendrogram.selectAll('path')
            .filter(d => d.data.indexes.includes(id_ind))
            .style("stroke-width", "2px");
    };
    const spacing = "\xa0\xa0\xa0\xa0|\xa0\xa0\xa0\xa0";
    let mousemove = function (d) {
        // Print data to tooltip from hovered-over heatmap element d
        tooltip.html("\xa0\xa0" +
            "Cohort: " + d.cohort + spacing +
            "TCGA Participant Barcode: " + d.tcga_participant_barcode + spacing +
            "Gene: " + d.gene + spacing +
            "Expression Level (log2): " + d.expression_log2.toFixed(5) + spacing +
            "Expression Z-Score: " + d["z-score"].toFixed(5))
    };
    let mouseleave = function (d) {
        // Make tooltip disappear and heatmap object return to z-score color
        tooltip.style("opacity", 0);
        d3.select(this).style("fill", d => colorScale_exp(d["z-score"]));
        // Make dendrogram path unbold
        let id_ind = unique_ids.indexOf(d.tcga_participant_barcode);
        svg_dendrogram.selectAll('path')
            .filter(d => d.data.indexes.includes(id_ind))
            .style("stroke-width", "0.5px");
    };
    let mousemove_samp = function (d) {
        let v = d3.select(this).attr("var")
        tooltip.html("\xa0\xa0" +
            "Cohort: " + d.cohort + spacing +
            "TCGA Participant Barcode: " + d.tcga_participant_barcode + spacing +
            v + ": " + d[v])
    }
    let mouseleave_samp = function (d) {
        tooltip.style("opacity", 0);
        d3.select(this).style("fill", d3.select(this).attr("fill0")) // re-fill color based on stored attribute
        // Make dendrogram path unbold
        let id_ind = unique_ids.indexOf(d.tcga_participant_barcode);
        svg_dendrogram.selectAll('path')
            .filter(d => d.data.indexes.includes(id_ind))
            .style("stroke-width", "0.5px");
    };


    ///// Build the Heatmap, Legend, and Dendrogram Below /////
    // Append the y-axis to the heatmap:
    svg_heatmap.append("g")
        .style("font-size", 9.5)
        .call(d3.axisLeft(y).tickSize(0))
        .select(".domain").remove();
    // Build the Legend:   
    svg_heatmap.selectAll()
        .data(zArr)
        .enter()
        .append('rect')
        .attr('x', heatWidth - margin.right)
        .attr('y', d => zScale(d))
        .attr("width", legendWidth / 2)
        .attr("height", 1 + (heatHeight / zArr.length))
        .style("fill", d => colorScale_exp(d));
    // Append the z-axis to the legend:
    svg_heatmap.append("g")
        .style("font-size", 10)
        .attr("transform", "translate(" + heatWidth + ",0)")
        .call(d3.axisRight().scale(zScale).tickSize(5).ticks(5));

    ///// Update function for creating plot with new order (clustering), new sample tracks
    function updateHeatmap() {
        // Build new x scale based on myGroups (in case re-sorted)
        x = x.domain(myGroups);

        // Re/build the heatmap (selecting by custom key 'tcga_id:gene'):
        svg_heatmap.selectAll()
            .data(dataInput, d => (d.tcga_participant_barcode + ':' + d.gene))
            .enter()
            .append("rect")
            .attr("x", d => x(d.tcga_participant_barcode))
            .attr("y", d => y(d.gene))
            .attr("width", x.bandwidth())
            .attr("height", y.bandwidth())
            .style("fill", d => colorScale_exp(d["z-score"]))
            .on("mouseover", mouseover)
            .on("mousemove", mousemove)
            .on("mouseleave", mouseleave);

        // Re/build sample tracks (currently only handles categorical data)
        // Get sample track selected vars (only in observable)
        //let sampTrackVars = getClinvarSelection();
        let sampTrackVars = Object.keys(clinicalData[0]).filter(el => (el.match(/^(?!cohort|date|tcga_participant_barcode$)/)));

        // Build color scales for all selected variables
        let colorScale_all = sampTrackVars.reduce((acc, v) => {
            let var_domain = d3.map(clinicalData, d => d[v]).keys().sort().filter(el => el !== "NA");
            acc[v] = d3.scaleOrdinal()
                .domain(var_domain)
                .range(d3.schemeCategory10)
                .unknown("lightgray"); return acc
        }, {})

        // Recompute total sample tracks height and update svg_sampletrack height
        let sampTrackHeight_total = (sampTrackHeight + margin.space) * sampTrackVars.length;
        svg_frame.select('.sampletrack').attr('height', sampTrackHeight_total)

        // Build new scale for sample track labels:
        let y_samp = d3.scaleBand()
            .range([0, sampTrackHeight_total])
            .domain(sampTrackVars);

        // Build sample track for each variable
        svg_sampletrack.html(""); // have to clear to keep some spaces as white
        sampTrackVars.forEach(v => {
            svg_sampletrack.selectAll()
                .data(clinicalData, d => (d.tcga_participant_barcode + ":" + v))
                .enter()
                .append("rect")
                .attr("var", v)
                .attr("x", d => x(d.tcga_participant_barcode))
                .attr("y", y_samp(v))
                .attr("width", x.bandwidth())
                .attr("height", sampTrackHeight)
                .style("fill", d => colorScale_all[v](d[v]))
                .attr("fill0", d => colorScale_all[v](d[v]))
                .on("mouseover", mouseover)
                .on("mousemove", mousemove_samp)
                .on("mouseleave", mouseleave_samp);
        })
        // Append labels axis to the sample track:
        svg_sampletrack.select('#sampLabels').remove(); // first remove previous labels
        svg_sampletrack.append("g")
            .attr('id', 'sampLabels')
            .style('font-size', 9.5)
            .call(d3.axisLeft(y_samp).tickSize(0))
            .select(".domain").remove();

        // Sample Track Legend:
        // function to get width of bounding text box for a given string, font-size
        let svg_temp = divObject.append("svg")
        function getTextWidth(str, fs) {
            let text_temp = svg_temp
                .append('text')
                .style('font-size', fs + "px")
                .text(str);
            var dim = text_temp.node().getBBox();
            return dim.width
        }

        // get max sizes of variable name and all unique variable labels (for column width), and number of variables (for legend height)
        let var_summary = sampTrackVars.map(v => {
            let myLabs = d3.map(clinicalData, d => d[v]).keys().sort().filter(el => el !== "NA").map(el => ({ val: el }));
            let var_width = getTextWidth(v + ":\xa0", 15); // text width of variable name
            let lab_width = Math.max(...myLabs.map(el => getTextWidth("\xa0" + el.val, 10))); // max text width of each unique label
            return { var: v, labs: myLabs, nlab: myLabs.length, max_width: Math.ceil(Math.max(lab_width + sampTrackHeight, var_width)) }
        })
        svg_temp.html("")

        // calculate cumulative sum of column widths with spacing for x-positioning each variable
        const cumulativeSum = (sum => value => sum += value)(0);
        let x_spacing = var_summary.map(el => el.max_width + margin.space).map(cumulativeSum);
        var_summary = var_summary.map(o => { o.x = x_spacing[var_summary.indexOf(o)] - o.max_width; return o });

        // fill sample track legend
        svg_sampLegend.html("");
        var_summary.forEach(v => {
            svg_sampLegend
                .append("text")
                .attr("x", v.x)
                .attr("alignment-baseline", "hanging")
                .style("font-size", "15px")
                .attr("text-decoration", "underline")
                .text(v.var + ":");
            svg_sampLegend.selectAll()
                .data(v.labs, d => v.var + ":" + d.val + "_box")
                .enter()
                .append("rect")
                .attr("x", v.x)
                .attr("y", (d, i) => 20 + i * (sampTrackHeight + margin.space))
                .attr("width", sampTrackHeight)
                .attr("height", sampTrackHeight)
                .style("fill", d => colorScale_all[v.var](d.val))
                .style("stroke", "black");
            svg_sampLegend.selectAll()
                .data(v.labs, d => v.var + ":" + d.val + "_text")
                .enter()
                .append("text")
                .attr("x", v.x + sampTrackHeight)
                .attr("y", (d, i) => 20 + i * (sampTrackHeight + margin.space) + sampTrackHeight / 2)
                .attr("alignment-baseline", "central")
                .style("font-size", "10px")
                .text(d => "\xa0" + d.val);
        });
        // adjust sampLegend size
        // height is max number of labels times entry height, plus space for title
        // width is cumulative sum of max label width for each column plus the colored rectangle and spacing
        let sampLegendHeight = 20 + (sampTrackHeight + margin.space) * Math.max(...var_summary.map(el => el.nlab));
        div_sampLegend.select(".sampLegend")
            .attr("height", sampLegendHeight + margin.space)
            .attr("width", var_summary.reduce((a, b) => a + b.max_width + sampTrackHeight + margin.space, 0))
        if (sampLegendHeight < 200) {
            div_sampLegend.select('#legend')
                .attr('height', sampLegendHeight + 'px')
        } else {
            div_sampLegend.select('#legend')
                .style('height', '200px')
        }

        if (sampTrackVars.length == 0) {
            svg_sampLegend
                .append("text")
                .attr("alignment-baseline", "hanging")
                .style("font-size", "18px")
                .text("No clinical features selected");
            div_sampLegend.select(".sampLegend")
                .attr("height", 20)
                .attr("width", 250)
            div_sampLegend.select('#legend')
                .style('height', '20px')
        };

        // Generate dendrogram IF clustering selected and ready
        if (doCluster && clusterReady) { // only show dendrogram if these flags indicate to show
            // Build dendrogram as links between nodes:
            cluster = d3.cluster().size([heatWidth - legendWidth, dendHeight]); // match dendrogram width to heatmap x axis range
            // Give the data to this cluster layout:
            data = clust_results.clusters;
            root = d3.hierarchy(data);
            cluster(root);

            // Build dendrogram as links between nodes:
            svg_dendrogram.selectAll('path')
                .data(root.descendants().slice(1))
                .enter()
                .append('path')
                .attr("d", elbow)
                .style("fill", 'none')
                .style("stroke-width", "0.5px")
                .attr("stroke", 'black')

            // Give dendrogram svg height and shift down heatmap + sampletracks
            svg_dendrogram.attr("height", dendHeight);
            svg_frame.select(".sampletrack")
                .attr("y", margin.top + dendHeight)
            svg_frame.select(".heatmap")
                .attr("y", margin.top + dendHeight + sampTrackHeight_total);
            frameHeight = margin.top + dendHeight + margin.space + heatHeight + sampTrackHeight_total + margin.bottom;
        
        } else { // otherwise remove the dendrogam and shift the heatmap up
            svg_dendrogram.attr("height", 0);
            svg_frame.select(".sampletrack")
                .attr("y", margin.top)
            svg_frame.select(".heatmap")
                .attr("y", margin.top + sampTrackHeight_total);
            frameHeight = margin.top + heatHeight + sampTrackHeight_total + margin.bottom;
        }
        // apply new frameHeight (adjusting for dendrogram and # sample tracks)
        svg_frame.attr('height', frameHeight)
    }
    updateHeatmap()

    // add update function to update button
    sortOptionDiv.select('#updateHeatmapButton')
        .on('click', function () {
            sortGroups();
            updateHeatmap();
        })
};
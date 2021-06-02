// Wrap it in a function that binds the utils t oteh addon object and msg object

export default function bindTo ({ addon, msg }, { BlockRow }) {
    /*var */window.Utils = {};

    // Table for the blocks

    Utils.Table = {};

    Utils.Table.buildColGroup = function (table, ...columns) {
        const colGroup = table.querySelector(".sa-debug-table-colgroup") || table.appendChild(document.createElement("colgroup"));
        colGroup.textContent = "";
        colGroup.classList.add("sa-debug-table-colgroup");
        const blockSvg = columns.find((column) => column.id === "blockSvg");
        if (blockSvg) {
            const blockSvgCol = document.createElement("col");
            blockSvgCol.classList.add("sa-debug-table-col", "sa-debug-blockSvg-col");
            const blockWidth = Math.max(...BlockRow.allBlocks.map((b) => b.workspace.getBlockById(b.blockId).width));
            blockSvgCol.style.width = blockWidth + "px";
            colGroup.appendChild(blockSvgCol);
        }
        const restCols = document.createElement("col");
        restCols.span = columns.length - (blockSvg ? 1 : 0);
        restCols.classList.add("sa-debug-table-col", "sa-debug-col-other");
        restCols.style.setProperty("--colNum", restCols.span);
        restCols.style.setProperty("--otherWidth", blockSvg ? blockWidth : "0");
        colGroup.appendChild(restCols);
        return colGroup;
    }

    Utils.Table.buildHeader = function (table, ...columns) {
        const headRow = table.querySelector(".sa-debug-table-header") || table.appendChild(document.createElement("tr"));
        headRow.textContent = "";
        headRow.classList.add("sa-debug-table-header");
        columns.forEach((column) => {
            const head = document.createElement("th");
            head.textContent = column.name || msg(column.id);
            head.classList.add("sa-debug-table-head");
            headRow.appendChild(head);
        });
        return headRow;
    }

    Utils.Table.buildColumnList = function () {
        const columns = [];
        const settingsEnabled = [];
        for (let settingName in scratchAddons.globalState.addonSettings[addon.self.id]) {
            if (settingName.startsWith("column-") && scratchAddons.globalState.addonSettings[addon.self.id][settingName]) settingsEnabled.push(settingName)
        }
        settingsEnabled.forEach((id) => {
            columns.push({
                id: id,
                name: msg(id)
            })
        });
        return columns;
    }

    Utils.Table.buildTable = function (container) {
        const tableEl = container.querySelector(".sa-debug-table") || container.appendChild(document.createElement("table"));
        tableEl.classList.add("sa-debug-table");
        tableEl.querySelectorAll("thead, colgroup").forEach((n) => n.textContent = "");
        const columns = Utils.Table.buildColumnList();
        tableEl.appendChild(Utils.Table.buildColGroup(tableEl, ...columns));
        tableEl.appendChild(Utils.Table.buildHeader(tableEl.appendChild(document.createElement("thead")), ...columns));
        return tableEl;
    }

    // Misc

    Utils.objectToArray = function (object) {
        var array = [];
        for (let key in object) {
            array[key] = object[key];
        }
        return array;
    }
    return Utils;
}
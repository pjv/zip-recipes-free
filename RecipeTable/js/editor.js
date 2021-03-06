jQuery(document).ready(function ($) {
    $(document).on('click', '.zrdn-add-author', function(){
        var field = $('.zrdn-template').get(0).outerHTML;

        console.log(field);
        $(this).closest('.field-group').find('.zrdn-author-frame').append(field);
        $(this).closest('.field-group').find('.zrdn-author-frame .zrdn-hidden').removeClass('zrdn-hidden');
    });
    $(document).on('click', '.zrdn-delete-author', function(){
        console.log("remove");
        $(this).closest('.zrdn-author-container').remove();
    });



    $.fn.outerHTML = function () {

        // IE, Chrome & Safari will comply with the non-standard outerHTML, all others (FF) will have a fall-back for cloning
        return (!this.length) ? this : (this[0].outerHTML || (
            function (el) {
                var div = document.createElement('div');
                div.appendChild(el.cloneNode(true));
                var contents = div.innerHTML;
                div = null;
                return contents;
            })(this[0]));

    };

    /**
     * Auto Clean extra spaces
     *
     * On paste in textarea removes extra spaces and lines
     */
    $(".zrdn-field-textarea").on('paste', function (e) {
        var $elem = $(this);
        // setTimeout is required here because paste event is triggered before content is pasted
        //  in element.
        window.setTimeout(function () {
            var lines = $elem.val().split(/\n/);
            var texts = [];
            for (var i=0; i < lines.length; i++) {
                if (/\S/.test(lines[i])) {
                    texts.push($.trim(lines[i]));
                }
            }
            var n = texts.join("\n");
            $elem.val(n);
        }, 500);
    });

    /**
     * Tabs
     */
    //tabs
    $(document).on('click', '.zrdn-tablinks', function () {
        $(".zrdn-tablinks").removeClass('active');
        $(this).addClass('active');
        $(".zrdn-tabcontent").removeClass('active');
        $("#" + $(this).data('tab')).addClass('active');
        $('input[name=zrdn_active_tab]').val($(this).data('tab'));
    });

    /**
     *  Initialize the preview fields with placeholders
     */
    if ($('#zrdn-preview').length) {
        var content = $('#zrdn-preview').html();

        //first, remove the json
        var json_matches = content.match(/{"@context".*?}}/g, '');
        if (json_matches) {
            content = content.replace(json_matches[0], '');
        }

        //replace to spans
        var regex = /(<.+?>[^<>]*?){([a-zA-Z_].*)_value}([^<>]*?<.+?>)/g;
        content = content.replace(regex, '$1' + '<span id="zrdn_placeholder_' + '$2' + '"></span>' + '$3');

        $('#zrdn-preview').html(content);

        //time
        $('.prep_time').html('<span id="zrdn_placeholder_prep_time"></span>');
        $('.cook_time').html('<span id="zrdn_placeholder_cook_time"></span>');
        // var placeholderImg = $('.zrdn-recipe-image').outerHTML();
        $('.zrdn-recipe-image').parent().append('<div class="zrdn-edit-image-text">' +
            zrdn_editor.str_click_to_edit_image +
            '</div>');


        /**
         * Now prefill the fields with what we have
         *
         */

        $('.zrdn-field-input').each(function () {

            var name = $(this).attr("name");
            if (name === 'zrdn_video_url') return;

            var fieldname = name.replace('zrdn_', 'zrdn_placeholder_');
            $('#' + fieldname).html($(this).val());
        });

        /**
         * video
         */
        $('input[name=zrdn_video_url]').each(function () {
            zrdn_get_video_embed($(this));
        });

        /**
         * time
         */
        $('input[type=number]').each(function () {
            zrdn_parse_time($(this));
        });

        /**
         * Textarea
         */

        $('.zrdn-field-textarea').each(function () {
            zrdn_parse_textarea($(this));
        });

        $('.wp-editor-area').each(function () {
            var name = $(this).attr("name");

            var fieldname = name.replace('zrdn_', 'zrdn_placeholder_');
            $('#' + fieldname).html($(this).val());
        });

        if ($('input[name=zrdn_recipe_image]').val().length > 0) {
            $('.zrdn-recipe-image').attr('src', $('input[name=zrdn_recipe_image]').val());
            var link = '<div style="clear:both"></div><a href="#" style="float:right" class="zrdn_remove_image">' + zrdn_editor.str_remove + '</a>';
            $('.zrdn-recipe-image').parent().append(link);
        }

        // Was needed a timeout since RTE is not initialized when this code run.
        setTimeout(function () {
            for (var i = 0; i < tinymce.editors.length; i++) {
                tinymce.editors[i].onChange.add(function (ed, e) {
                    var name = ed.id;
                    var fieldname = name.replace('zrdn_', 'zrdn_placeholder_');
                    $('#' + fieldname).html(ed.getContent());
                });

                tinymce.editors[i].onKeyUp.add(function (ed, e) {
                    var name = ed.id;

                    var fieldname = name.replace('zrdn_', 'zrdn_placeholder_');

                    $('#' + fieldname).html(ed.getContent());

                });
            }
        }, 1000);
    }

    /**
     * remove image
     */
    $(document).on('click','.zrdn_remove_image',function(event){
        event.preventDefault();

        $(".zrdn-recipe-save-button input").prop('disabled', true);
        $(".zrdn-recipe-save-button button").prop('disabled', true);

        var image = $(this).parent().find('.zrdn-recipe-image');
        var recipe_id = $('input[name=zrdn_recipe_id]').val();
        $.ajax({
            type: "POST",
            url: zrdn_editor.admin_url,
            dataType: 'json',
            data: ({
                recipe_id : recipe_id,
                nonce : zrdn_editor.nonce,
                action: 'zrdn_clear_image',
            }),
            success: function (response) {
                if (response.success) {
                    image.attr('src', zrdn_editor.default_image);
                    image.attr('srcset', zrdn_editor.default_image);
                    $('input[name=zrdn_recipe_image]').val('');
                    $('input[name=zrdn_recipe_image_id]').val(0);

                } else {
                    image.parent().append(' Clearing image failed...');
                }
                $(".zrdn-recipe-save-button button").prop('disabled', false);
                $(".zrdn-recipe-save-button input").prop('disabled', false);
            }
        });

    });

    /**
     * manage recipe field sync with preview
     */

    $(document).on('keyup', 'input[type=text]', function (e) {
        maybeShowNutritionLabel();

        var name = $(this).attr("name");
        if (name==='zrdn_video_url') return;
        if (name===undefined) return;
        if (name.indexOf('zrdn_')===-1) return;
        var fieldname = name.replace('zrdn_', 'zrdn_placeholder_');
        $('#' + fieldname).html($(this).val());
    });

    /**
     * time
     */

    $(document).on('keyup mouseup', 'input[type=number]', function (e) {
        zrdn_parse_time($(this));
    });

    /**
     * Textarea's are lists, so we split in arrays for lists here
     */

    $(document).on('keyup', 'textarea', function (e) {
        zrdn_parse_textarea($(this));
    });

    function zrdn_parse_time(obj){
        var name = obj.attr("name");
        if (name.indexOf('zrdn_')===-1) return;

        //when this field is changed, we also need to get the other, hour or minute
        //so we get the master fieldname, then get both
        var masterFieldname = name.replace('_minutes', '').replace('_hours', '');
        var minutes = parseInt($('input[name=' + masterFieldname + '_minutes]').val());
        var hours = parseInt($('input[name=' + masterFieldname + '_hours]').val());
        var fieldname = masterFieldname.replace('zrdn_', 'zrdn_placeholder_');

        var timeString = '';
        if (hours > 0) {
            timeString += hours + ' '+zrdn_editor.str_hours;
        }

        if (minutes > 0) {
            if (timeString.length > 0) minutes = ', ' + minutes;

            timeString += minutes + ' '+ zrdn_editor.str_minutes;
        }

        $('#' + fieldname).html(timeString);
    }

    function zrdn_parse_textarea(obj) {

        var name = obj.attr("name");
        if (name.indexOf('zrdn_') === -1) return;

        var parentContainer;
        var parentTag = 'UL';
        var fieldname = name.replace('zrdn_', 'zrdn_placeholder_');
        var fieldPlaceholder = $('#' + fieldname);
        fieldPlaceholder.html('');
        var placeholderHtml = fieldPlaceholder.outerHTML();

        if (fieldPlaceholder.parent().prop("tagName") === 'LI') {
            parentContainer = fieldPlaceholder.parent().parent();
        } else {
            parentContainer = fieldPlaceholder.parent();
        }

        parentTag = parentContainer.prop('tagName');
        var values = obj.val().split("\n");

        //remove empty lines
        values = values.filter(Boolean);
        values.forEach(function (element) {
            //check if this is multi part
            if (element.substring(0, 1) === '!') {
                placeholderHtml += '</' + parentTag + '><b>' + element.substring(1) + '</b><' + parentTag + '>';

                //images
            } else if (element.substring(0, 1) === '%') {

                var regex = /(?:%)([http|https?:\/\/=?\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:\/?#[\]@!\$&'\(\)\*\+,;=.\/]+[a-zA-N])/g;
                var match = element.match(regex);
                if (match) {
                    var percent_image = match[0];
                    var image = percent_image.substring(1);
                    placeholderHtml += element.replace(percent_image, '<img style="max-width:100%" src="' + image + '">');
                }
            } else {
                //default
                placeholderHtml += '<li>' + element + '</li>';
            }
        });

        if (placeholderHtml.length) {
            //handle bold
            var i;
            var regex = /(\*[a-zA-Z\-\_\(\)\<\>\/\\\$\!\@\#\:\;\.\,\?\+\=]*\*)/g;
            var matches = placeholderHtml.match(regex);
            if (matches && matches.length) {
                for (i = 0; i < matches.length; i++) {
                    var match = matches[i];
                    var bold = match;
                    bold = bold.replace(/\*$/i, "</b>").replace(/^\*/i, "<b>");
                    placeholderHtml = placeholderHtml.replace(match, bold);
                }
            }
            //hyperlinks
            regex = /\[([^\]\|\[]*)\|([^\]\|\[]*)\]/g;
            matches = placeholderHtml.match(regex);
            if (matches && matches.length) {
                for (i = 0; i < matches.length; i++) {
                    placeholderHtml = placeholderHtml.replace(/\[([^\]\|\[]*)\|([^\]\|\[]*)\]/i, '<a href="' + '$1' + '">'+'$2'+'</a>');
                }
            }

            //italic
            // regex = /(\_[a-zA-Z\-\_\(\)\<\>\/\\\$\!\@\#\:\;\.\,\?\+\=]*\_)/g;
            // matches = placeholderHtml.match(regex);
            // if (matches && matches.length) {
            //     for (i = 0; i < matches.length; i++) {
            //         var match = matches[i];
            //         if (match === '_placeholder_') return;
            //
            //         var bold = match;
            //         console.log(bold);
            //         bold = bold.replace(/\_$/i, "</i>").replace(/^\_/i, "<i>");
            //         placeholderHtml = placeholderHtml.replace(match, bold);
            //         console.log(bold);
            //     }
            // }
        }

        // $bold = '/(^|\s)\*([^\s\*][^\*]*[^\s\*]|[^\s\*])\*(\W|$)/i';
        // $italic = '/(^|\s)_([^\s_][^_]*[^\s_]|[^\s_])_(\W|$)/i';

        //preserve linebreaks by transforming them to br
        parentContainer.html(placeholderHtml);
    }

    /**
     * Image
     */

    var media_uploader = null;
    $(document).on( 'click','.zrdn-recipe-image', function()
    {
        var img = $(this);
        media_uploader = wp.media({
            frame:    "post",
            state:    "insert",
            multiple: false
        });

        media_uploader.on("insert", function(){
            img.wrap( '<div class="loading-gif"></div>' );
            $(img).load(function(){
                img.unwrap();
            });
            var length = media_uploader.state().get("selection").length;
            var images = media_uploader.state().get("selection").models;

            for(var iii = 0; iii < length; iii++)
            {
                var thumbnail_id = images[iii].id;
                var image;
                if (images[iii].attributes.sizes.hasOwnProperty('zrdn_recipe_image')) {
                    image = images[iii].attributes.sizes['zrdn_recipe_image'];
                } else if(images[iii].attributes.sizes.hasOwnProperty('large')) {
                    image = images[iii].attributes.sizes['large'];
                } else {
                    image = images[iii].attributes.sizes['full'];
                }
                var image_url = image['url'];

                img.attr('src', image_url);
                // put thumbnail id in hidden field
                $('input[name=zrdn_recipe_image_id]').val(thumbnail_id);
                $('input[name=zrdn_recipe_image]').val(image_url);

            }
        });

        media_uploader.open();
    });


    /**
     * Rich snippets uploader
     */
    $(document).on('click','.zrdn-image-reset',function(){
        var btn = $(this);
        var container = btn.closest('.zrdn-field');
        var textField = container.find('.zrdn-image-upload-field');
        var fieldname = textField.attr('name');
        container.find('.zrdn-preview-snippet').attr('src',zrdn_editor.image_placeholder);
        $('input[name='+fieldname+'_id]').val('');
        $('input[name='+fieldname+']').val('');
    });

    $(document).on( 'click','.zrdn-image-uploader', function()
    {
        var btn = $(this);
        var container = btn.closest('.zrdn-field');
        var textField = container.find('.zrdn-image-upload-field');
        var size = textField.data('size');
        var fieldname = textField.attr('name');
        console.log(fieldname);
        //cleanup
        container.find('.zrdn-image-resolution-warning').hide();

        media_uploader = wp.media({
            frame:    "post",
            state:    "insert",
            multiple: false
        });

        media_uploader.on("insert", function(){

            container.append( '<div class="loading-gif"></div>' );

            var length = media_uploader.state().get("selection").length;
            var images = media_uploader.state().get("selection").models;

            for(var iii = 0; iii < length; iii++)
            {
                var thumbnail_id = images[iii].id;
                var image = false;
                console.log(images[iii]);
                if (images[iii].attributes.sizes.hasOwnProperty(size)) {
                    image = images[iii].attributes.sizes[size];
                } else if(images[iii].attributes.sizes.hasOwnProperty(size+'_s')) {
                    image = images[iii].attributes.sizes[size+'_s'];
                } else if(images[iii].attributes.sizes.hasOwnProperty('thumbnail')) {
                    image = images[iii].attributes.sizes['thumbnail'];
                }

                if (image) {
                    console.log(image);
                    var image_url = image['url'];
                    console.log(image_url);
                    container.find('.zrdn-preview-snippet').attr('src',image_url);
                    $('input[name='+fieldname+'_id]').val(thumbnail_id);
                    $('input[name='+fieldname+']').val(image_url);

                } else {
                    container.find('.zrdn-image-resolution-warning').show();
                }

            }
            container.find('.loading-gif').remove();
        });

        media_uploader.open();
    });

    /**
     * video
     */
    $(document).on('keyup', 'input[name=zrdn_video_url]', function(){
        zrdn_get_video_embed($(this));
    });

    function zrdn_get_video_embed(obj){
        var name = obj.attr("name");
        if (name===undefined) return;
        if (name.indexOf('zrdn_')===-1) return;
        var fieldname = name.replace('zrdn_', 'zrdn_placeholder_');
        var video_url = obj.val();
        $.ajax({
            type: "GET",
            url: zrdn_editor.admin_url,
            dataType: 'json',
            data: ({
                video_url : video_url,
                action: 'zrdn_get_embed_code',
            }),
            success: function (response) {
                if (response.success) {
                    $('#' + fieldname).html(response.embed);
                }
            }
        });
    }




    /**
     * hide nutrition label if no data available
     */

    maybeShowNutritionLabel();
    function maybeShowNutritionLabel(){
        if (!$("#zrdn-nutrition-label").length) return;

        var label = $("#zrdn-nutrition-label");
        if ($("input[name=zrdn_calories]").val().length===0){
            label.hide();
        } else{
            label.show();
        }
    }



});

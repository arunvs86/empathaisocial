$(document).ready(() => {
    $.get("/api/posts/" + postId, results => {
        outputPostsWithReplies(results, $(".postsContainer"));
    })
})

$(document).on("click", ".markAsSpamButton", (event) => {
    var button = $(event.target);
    var postId = getPostIdFromElement(button);
    
    var spamReason = prompt("Please select the reason for reporting this post as spam: (Harassment, Misinformation, Inappropriate Content, Other)");
    
    if (!postId || !spamReason) return;

    if(postId === undefined) return;

    $.ajax({
        url: `/api/posts/markAsSpam/${postId}`,
        type: "PUT",
        data: { spamReason: spamReason }, // Send the selected spam reason
        success: (postData) => {
            // Update the UI accordingly
            $(event.target).find("span").text(postData.spamMarks || "");
            if (postData.spamMarkedBy.includes(userLoggedIn._id)) {
                $(event.target).addClass("active");
                emitNotification(postData.postedBy);
            } else {
                $(event.target).removeClass("active");
            }
        }
    });

})
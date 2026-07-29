package com.mahagnan.model;

import java.time.LocalDateTime;

public class CodingAnswer {

    private String id;
    private String submissionId;
    private String questionId;
    private String language;
    private String sourceCode;
    private int awardedMarks;
    private String reviewerRemark;
    private LocalDateTime lastSaved;

    public CodingAnswer() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getSubmissionId() {
        return submissionId;
    }

    public void setSubmissionId(String submissionId) {
        this.submissionId = submissionId;
    }

    public String getQuestionId() {
        return questionId;
    }

    public void setQuestionId(String questionId) {
        this.questionId = questionId;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public String getSourceCode() {
        return sourceCode;
    }

    public void setSourceCode(String sourceCode) {
        this.sourceCode = sourceCode;
    }

    public int getAwardedMarks() {
        return awardedMarks;
    }

    public void setAwardedMarks(int awardedMarks) {
        this.awardedMarks = awardedMarks;
    }

    public String getReviewerRemark() {
        return reviewerRemark;
    }

    public void setReviewerRemark(String reviewerRemark) {
        this.reviewerRemark = reviewerRemark;
    }

    public LocalDateTime getLastSaved() {
        return lastSaved;
    }

    public void setLastSaved(LocalDateTime lastSaved) {
        this.lastSaved = lastSaved;
    }
}
